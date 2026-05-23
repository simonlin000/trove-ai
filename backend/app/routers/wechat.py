"""WeChat bot binding API — user-facing self-service for binding a personal
WeChat account to the Trove AI RAG bot.

Flow:
  POST /api/wechat/bind/start
      → calls ilinkai to mint a QR, returns base64 PNG + signed session token
  GET  /api/wechat/bind/status?session=<token>
      → long-polls ilinkai for scan progress; on confirmed, saves creds to
        wechat_accounts and returns success
  GET  /api/wechat/account
      → current user's bound account state (for the settings UI)
  DELETE /api/wechat/account
      → unbind; sets is_active=false (history retained)

Stateless: bind sessions live entirely in a JWT-signed token (qrcode + base_url
+ exp) so this works across uvicorn workers without Redis or sticky sessions.
See memory: trove_wechat_bot, reference_openclaw_weixin.
"""
import base64
import io
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status as http_status
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, SECRET_KEY, ALGORITHM
from app.models import User, WechatAccount

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/wechat", tags=["wechat"])

# ── ilinkai constants ──────────────────────────────────────────────────
ILINKAI_DEFAULT_BASE = "https://ilinkai.weixin.qq.com"
ILINK_APP_ID = "bot"
# openclaw-weixin 2.4.3 encodes version as (2<<16)|(4<<8)|3 = 132099.
ILINK_APP_CLIENT_VERSION = "132099"
ILINK_BOT_TYPE = "3"
QR_LONG_POLL_TIMEOUT = 35  # seconds; matches openclaw client


def _random_wechat_uin() -> str:
    """X-WECHAT-UIN: random uint32 -> decimal string -> base64."""
    n = secrets.randbelow(2**32)
    return base64.b64encode(str(n).encode()).decode()


def _ilinkai_headers(token: Optional[str] = None) -> dict:
    h = {
        "iLink-App-Id": ILINK_APP_ID,
        "iLink-App-ClientVersion": ILINK_APP_CLIENT_VERSION,
        "AuthorizationType": "ilink_bot_token",
        "X-WECHAT-UIN": _random_wechat_uin(),
        "Content-Type": "application/json",
    }
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


# ── Bind session token (JWT-signed, 5-min TTL) ─────────────────────────
BIND_SESSION_AUD = "wechat-bind"
BIND_TTL_MINUTES = 5


def _encode_bind_session(qrcode: str, base_url: str, user_id: str) -> str:
    payload = {
        "qrcode": qrcode,
        "base_url": base_url,
        "user_id": user_id,
        "aud": BIND_SESSION_AUD,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=BIND_TTL_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _decode_bind_session(token: str, expected_user_id: str) -> dict:
    try:
        payload = jwt.decode(
            token, SECRET_KEY, algorithms=[ALGORITHM], audience=BIND_SESSION_AUD
        )
    except JWTError as e:
        raise HTTPException(status_code=400, detail=f"绑定会话已过期或无效，请重新生成二维码")
    if payload.get("user_id") != expected_user_id:
        raise HTTPException(status_code=403, detail="会话与当前用户不匹配")
    return payload


# ── Response models ────────────────────────────────────────────────────
class BindStartResponse(BaseModel):
    session: str
    qr_image_content: str  # url string OR base64 PNG; pass-through from ilinkai


class BindStatusResponse(BaseModel):
    status: str  # wait / scaned / confirmed / expired / error
    session: Optional[str] = None  # updated if baseUrl was redirected
    display_name: Optional[str] = None
    message: Optional[str] = None


class AccountInfo(BaseModel):
    id: UUID
    account_id: str
    wechat_user_id: Optional[str]
    display_name: Optional[str]
    is_active: bool
    last_seen_at: Optional[datetime]
    created_at: Optional[datetime]


# ── Endpoints ──────────────────────────────────────────────────────────
@router.post("/bind/start", response_model=BindStartResponse, status_code=201)
async def bind_start(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mint a fresh QR code from ilinkai and return a signed bind-session token."""
    # If the user already has an active binding, refuse to start a new one without
    # explicit unbind. UX: caller should DELETE /api/wechat/account first.
    existing = await db.execute(
        select(WechatAccount).where(
            WechatAccount.user_id == current_user.id, WechatAccount.is_active.is_(True)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="当前用户已绑定微信账号，请先解绑再重新绑定。",
        )

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"{ILINKAI_DEFAULT_BASE}/ilink/bot/get_bot_qrcode",
                params={"bot_type": ILINK_BOT_TYPE},
                headers=_ilinkai_headers(),
                json={"local_token_list": []},
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as e:
        logger.exception(f"ilinkai QR fetch failed: {e}")
        raise HTTPException(status_code=502, detail=f"获取微信二维码失败：{type(e).__name__}")

    qrcode_id = data.get("qrcode")
    qr_target_url = data.get("qrcode_img_content")
    if not qrcode_id or not qr_target_url:
        raise HTTPException(status_code=502, detail=f"ilinkai 返回缺字段：{list(data)[:5]}")

    # ilinkai returns `qrcode_img_content` as a *URL* (e.g. https://liteapp.weixin.qq.com/q/...)
    # that the WeChat client should resolve when scanned — NOT a rendered image.
    # Render it into a PNG ourselves so the frontend can show <img src="data:..."/>.
    try:
        import qrcode as qr_lib
        img = qr_lib.make(qr_target_url, box_size=8, border=2)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        qr_data_uri = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    except Exception as e:
        logger.exception(f"QR render failed: {e}")
        # Last-resort: pass through the raw URL; frontend can show it as fallback text/link
        qr_data_uri = qr_target_url

    session_token = _encode_bind_session(qrcode_id, ILINKAI_DEFAULT_BASE, str(current_user.id))
    logger.info(f"WeChat bind started for user={current_user.username}")
    return BindStartResponse(session=session_token, qr_image_content=qr_data_uri)


@router.get("/bind/status", response_model=BindStatusResponse)
async def bind_status(
    session: str = Query(..., description="Token returned by /bind/start"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Long-poll ilinkai for QR scan status. Returns immediately if state changed.

    On `confirmed`, persists the bot_token+wechat_user_id into wechat_accounts
    and the user is now bound. The caller can poll repeatedly until terminal.
    """
    payload = _decode_bind_session(session, str(current_user.id))
    qrcode = payload["qrcode"]
    base_url = payload["base_url"]

    try:
        async with httpx.AsyncClient(timeout=QR_LONG_POLL_TIMEOUT + 5) as client:
            resp = await client.get(
                f"{base_url}/ilink/bot/get_qrcode_status",
                params={"qrcode": qrcode},
                headers=_ilinkai_headers(),
            )
            resp.raise_for_status()
            data = resp.json()
    except (httpx.TimeoutException, httpx.ReadTimeout):
        # Long-poll timeout is normal — tell client to poll again.
        return BindStatusResponse(status="wait")
    except httpx.HTTPError as e:
        logger.exception(f"ilinkai status poll failed: {e}")
        return BindStatusResponse(status="error", message=f"网络错误：{type(e).__name__}")

    ilink_status = data.get("status", "")

    if ilink_status == "scaned_but_redirect":
        new_base = data.get("redirect_host") or base_url
        if not new_base.startswith("http"):
            new_base = "https://" + new_base
        new_session = _encode_bind_session(qrcode, new_base, str(current_user.id))
        return BindStatusResponse(status="scaned", session=new_session)

    if ilink_status == "confirmed":
        bot_token = data.get("bot_token")
        ilink_bot_id = data.get("ilink_bot_id")
        ilink_user_id = data.get("ilink_user_id")
        result_base_url = data.get("baseurl") or base_url
        if not (bot_token and ilink_bot_id):
            return BindStatusResponse(status="error", message="ilinkai 返回缺凭证字段")

        # Save credentials. The partial unique index protects against races —
        # if another bind landed first, we'll get an integrity error and tell
        # the user to refresh.
        acct = WechatAccount(
            user_id=current_user.id,
            account_id=str(ilink_bot_id),
            wechat_user_id=str(ilink_user_id) if ilink_user_id else None,
            token=str(bot_token),
            base_url=str(result_base_url),
            is_active=True,
        )
        db.add(acct)
        try:
            await db.commit()
        except Exception as e:
            await db.rollback()
            logger.warning(f"WeChat bind commit failed (likely concurrent bind): {e}")
            raise HTTPException(status_code=409, detail="并发绑定冲突，请刷新页面重试。")

        logger.info(
            f"WeChat bound: user={current_user.username} account_id={ilink_bot_id} "
            f"wechat_user_id={ilink_user_id}"
        )
        return BindStatusResponse(status="confirmed", message="绑定成功")

    if ilink_status in ("expired", "verify_code_blocked"):
        return BindStatusResponse(status="expired", message="二维码已失效，请刷新重新生成。")

    # wait / scaned / need_verifycode → keep polling
    return BindStatusResponse(status=ilink_status or "wait")


@router.get("/account", response_model=Optional[AccountInfo])
async def get_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the current user's active WeChat binding, or null if none."""
    result = await db.execute(
        select(WechatAccount).where(
            WechatAccount.user_id == current_user.id, WechatAccount.is_active.is_(True)
        )
    )
    acct = result.scalar_one_or_none()
    if not acct:
        return None
    return AccountInfo(
        id=acct.id,
        account_id=acct.account_id,
        wechat_user_id=acct.wechat_user_id,
        display_name=acct.display_name,
        is_active=acct.is_active,
        last_seen_at=acct.last_seen_at,
        created_at=acct.created_at,
    )


@router.delete("/account", status_code=200)
async def unbind_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-unbind: marks is_active=false. Bot will stop polling this account
    on its next refresh cycle. History row kept for audit."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        update(WechatAccount)
        .where(
            WechatAccount.user_id == current_user.id, WechatAccount.is_active.is_(True)
        )
        .values(is_active=False, unbound_at=now)
        .returning(WechatAccount.id)
    )
    row = result.first()
    await db.commit()
    if not row:
        return {"ok": True, "message": "未绑定任何微信账号"}
    return {"ok": True, "message": "已解绑"}
