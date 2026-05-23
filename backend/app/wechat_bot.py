"""Multi-account WeChat bot runner.

Reads bound WeChat accounts from the wechat_accounts table, spawns one async
long-polling loop per account, routes each inbound message to its owning
Trove AI user via the X-Act-As-User header (requires the bot's service token
to be mapped to a superadmin user).

Run inside the same Docker image as the backend (which gives us DB access and
parser_service):

    TROVE_BASE=http://backend:8000 TROVE_TOKEN=<superadmin-token> \
    python -m app.wechat_bot

See memory: trove_wechat_bot, reference_openclaw_weixin.
"""
from __future__ import annotations

import asyncio
import base64
import html
import json
import logging
import os
import re
import secrets
import signal
import sys
import time
from datetime import datetime, timezone
from typing import AsyncIterator, Callable, Dict, Optional
from uuid import UUID

import httpx
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models import WechatAccount


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("trove.wechat-bot")


# ── ilinkai wire constants ─────────────────────────────────────────────
ILINK_APP_ID = "bot"
ILINK_APP_CLIENT_VERSION = "132099"
BOT_AGENT = "TroveBot/0.2-multi"
LONGPOLL_TIMEOUT_S = 35

URL_RE = re.compile(
    r"https?://[^\s一-鿿\"'<>{}|\\^`，。、；：！？（）【】《》]+",
    re.IGNORECASE,
)

# Heuristic: queries containing any of these keywords are routed to deep research
# automatically (no need for /r prefix). Conservative — only obvious "synthesis"
# verbs. Other queries default to the fast single-shot RAG path.
COMPLEX_KEYWORDS = (
    "梳理", "综述", "对比", "比较", "演化", "演变", "整理一下", "归纳",
    "哪些", "全面", "系统讲", "系统总结", "汇总", "不同观点",
    "演进", "发展脉络", "区别和联系",
)


def _is_complex_query(text: str) -> bool:
    """Cheap rule-based classifier — no LLM call.

    Returns True if the query is "obviously" a synthesis/comparison/list task.
    Errs on the side of False (fast path) when ambiguous; users can force the
    research path with /r prefix.
    """
    if not text or len(text) < 12:
        return False
    return any(kw in text for kw in COMPLEX_KEYWORDS)


def _random_uin() -> str:
    n = secrets.randbelow(2**32)
    return base64.b64encode(str(n).encode()).decode()


def _ilink_headers(token: str) -> dict:
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
        "AuthorizationType": "ilink_bot_token",
        "X-WECHAT-UIN": _random_uin(),
        "iLink-App-Id": ILINK_APP_ID,
        "iLink-App-ClientVersion": ILINK_APP_CLIENT_VERSION,
    }


def _base_info() -> dict:
    return {"channel_version": "2.4.3", "bot_agent": BOT_AGENT}


def _client_id() -> str:
    return f"trove-bot:{int(time.time() * 1000)}-{secrets.token_hex(4)}"


def _extract_url(text: str) -> Optional[str]:
    m = URL_RE.search(html.unescape(text or ""))
    return m.group(0).rstrip(".,;:!?)]") if m else None


# ── Trove AI backend calls (per-user via X-Act-As-User) ────────────────
class TroveClient:
    def __init__(self, base_url: str, service_token: str):
        self.base_url = base_url.rstrip("/")
        self.token = service_token
        # one shared httpx client; longer than long-poll for upload paths
        self._client = httpx.AsyncClient(timeout=90.0)

    async def close(self):
        await self._client.aclose()

    def _h(self, target_user_id: UUID) -> dict:
        return {
            "Authorization": f"Bearer {self.token}",
            "X-Act-As-User": str(target_user_id),
            "Content-Type": "application/json",
        }

    async def add_article(self, target_user_id: UUID, url: str) -> tuple[bool, str]:
        try:
            r = await self._client.post(
                f"{self.base_url}/api/articles",
                headers=self._h(target_user_id),
                json={"url": url},
            )
        except Exception as e:
            return False, f"❌ 网络错误：{type(e).__name__}"

        if r.status_code == 201:
            data = r.json()
            title = (data.get("title") or "Untitled")[:50]
            return True, f"✅ 已添加：{title}"
        if r.status_code == 409:
            return True, "ℹ️ 这条已经在库里了"
        try:
            detail = r.json().get("detail", "")
        except Exception:
            detail = r.text[:100]
        return False, f"❌ 添加失败 ({r.status_code})：{detail}"

    async def research_stream(
        self, target_user_id: UUID, query: str, mode: str = "sequential"
    ) -> AsyncIterator[dict]:
        """Open an SSE stream against research endpoints, yielding decoded events.

        mode='sequential' → /ask (fixed 4-stage)
        mode='tool'       → /agent (ReAct loop with library tools)
        """
        endpoint = "/api/research/agent" if mode == "tool" else "/api/research/ask"
        async with self._client.stream(
            "POST",
            f"{self.base_url}{endpoint}",
            headers=self._h(target_user_id),
            json={"query": query},
            timeout=300,
        ) as resp:
            if resp.status_code != 200:
                body = await resp.aread()
                yield {"stage": "error", "message": f"研究助理启动失败 ({resp.status_code}): {body[:200]!r}"}
                return
            async for line in resp.aiter_lines():
                if not line or not line.startswith("data: "):
                    continue
                try:
                    yield json.loads(line[6:])
                except Exception as e:
                    logger.warning(f"bad SSE line: {e}: {line[:120]}")

    async def create_spark(self, target_user_id: UUID, sentence: str) -> dict:
        """Call /api/articles/spark — generates a full article from a one-liner topic.
        Returns the article dict (id, title, content...) or {error: str}."""
        try:
            r = await self._client.post(
                f"{self.base_url}/api/articles/spark",
                headers=self._h(target_user_id),
                json={"sentence": sentence, "enable_search": False},
                timeout=240,
            )
        except Exception as e:
            return {"error": f"网络错误：{type(e).__name__}"}
        if r.status_code != 201:
            try:
                detail = r.json().get("detail", "")
            except Exception:
                detail = r.text[:200]
            return {"error": f"生成失败 ({r.status_code})：{detail}"}
        return r.json()

    async def ask(self, target_user_id: UUID, question: str) -> str:
        try:
            r = await self._client.post(
                f"{self.base_url}/api/assistant/ask",
                headers=self._h(target_user_id),
                json={"question": question, "top_k": 5},
            )
        except Exception as e:
            return f"❌ 网络错误：{type(e).__name__}"
        if r.status_code != 200:
            try:
                detail = r.json().get("detail", "")
            except Exception:
                detail = r.text[:100]
            return f"❌ 检索失败 ({r.status_code})：{detail}"
        data = r.json()
        answer = (data.get("answer") or "").strip() or "（空回答）"
        cites = data.get("citations") or []
        if cites:
            titles = "、".join(c.get("title", "")[:20] for c in cites[:3])
            return f"{answer}\n\n📚 参考：{titles}"
        return answer


# ── Per-account long-poll loop ─────────────────────────────────────────
class AccountWorker:
    def __init__(self, account_id: UUID, lm: TroveClient):
        self.account_id = account_id
        self.lm = lm
        self._stop = asyncio.Event()
        self._task: Optional[asyncio.Task] = None

    def start(self):
        self._task = asyncio.create_task(self._run(), name=f"wechat-{self.account_id}")

    async def stop(self):
        self._stop.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass

    async def _load(self) -> Optional[WechatAccount]:
        async with async_session() as db:
            r = await db.execute(
                select(WechatAccount).where(WechatAccount.id == self.account_id)
            )
            return r.scalar_one_or_none()

    async def _save_cursor(self, cursor: str):
        async with async_session() as db:
            await db.execute(
                update(WechatAccount)
                .where(WechatAccount.id == self.account_id)
                .values(sync_cursor=cursor)
            )
            await db.commit()

    async def _mark_seen(self):
        async with async_session() as db:
            await db.execute(
                update(WechatAccount)
                .where(WechatAccount.id == self.account_id)
                .values(last_seen_at=datetime.now(timezone.utc))
            )
            await db.commit()

    async def _send_text(self, client: httpx.AsyncClient, base_url: str, token: str,
                         to_user_id: str, context_token: Optional[str], text: str) -> None:
        body = {
            "msg": {
                "from_user_id": "",
                "to_user_id": to_user_id,
                "client_id": _client_id(),
                "message_type": 2,
                "message_state": 2,
                "item_list": [{"type": 1, "text_item": {"text": text}}],
                **({"context_token": context_token} if context_token else {}),
            },
            "base_info": _base_info(),
        }
        try:
            r = await client.post(
                f"{base_url}/ilink/bot/sendmessage",
                headers=_ilink_headers(token),
                json=body,
                timeout=15,
            )
            if r.status_code != 200:
                logger.warning(f"[{self.account_id}] sendmessage {r.status_code}: {r.text[:200]}")
        except Exception as e:
            logger.warning(f"[{self.account_id}] sendmessage failed: {e}")

    async def _handle(self, client: httpx.AsyncClient, acct: WechatAccount, msg: dict):
        sender = msg.get("from_user_id") or ""
        ctx = msg.get("context_token") or ""
        text = ""
        for it in (msg.get("item_list") or []):
            if it.get("type") == 1:
                text = (it.get("text_item") or {}).get("text", "") or ""
                break

        if not text:
            await self._send_text(client, acct.base_url, acct.token, sender, ctx,
                                  "目前只支持文本消息（链接或问题）哦")
            return

        text_stripped = text.strip()

        # /h or /help — show available commands
        if text_stripped in ("/h", "/help", "帮助"):
            await self._send_text(
                client, acct.base_url, acct.token, sender, ctx,
                "📚 Trove AI 用法\n\n"
                "• 直接发链接 → 自动存入你的知识库\n"
                "• 直接发问题 → 自动判断走快路径（3-5s）或深度研究（20-40s）\n"
                "  含「梳理/综述/对比/演化/哪些…」等词会自动深度研究\n"
                "• /r <问题> → 强制 4 阶段研究（拆解→检索→综述→自审）\n"
                "• /a <问题> → 强制工具型 Agent（ReAct 循环：自己选 search/read/list 工具）\n"
                "• /c <主题> → 灵感创作（AI 一句话生成完整文章入库，30-90s）\n"
                "  例：/c AI Agent 在 PM 工作流中的应用\n"
                "• /help → 显示本帮助",
            )
            return

        url = _extract_url(text)
        if url:
            ok, reply = await self.lm.add_article(acct.user_id, url)
            logger.info(f"[{acct.account_id}] add_article ok={ok} → {reply[:80]}")
            await self._send_text(client, acct.base_url, acct.token, sender, ctx, reply)
            return

        # Spark creation: /c <topic> → AI 灵感创作 generates full article
        if text_stripped.startswith("/c ") or text_stripped.startswith("/create "):
            topic = text_stripped.split(" ", 1)[1].strip()
            if not topic:
                await self._send_text(
                    client, acct.base_url, acct.token, sender, ctx,
                    "请在 /c 后面写主题。例：/c AI Agent 在产品经理工作流中的应用",
                )
                return
            await self._handle_spark(client, acct, sender, ctx, topic)
            return

        # Tool-using agent: /a or /agent prefix
        if text_stripped.startswith("/a ") or text_stripped.startswith("/agent "):
            query = text_stripped.split(" ", 1)[1].strip()
            if not query:
                await self._send_text(
                    client, acct.base_url, acct.token, sender, ctx,
                    "请在 /a 后面写具体问题。例：/a 帮我从库里挑 5 篇做 AI Agent 综述的素材",
                )
                return
            await self._handle_research(client, acct, sender, ctx, query, mode="tool")
            return

        # Sequential research: explicit /r or /research prefix
        explicit_research = False
        if text_stripped.startswith("/r ") or text_stripped.startswith("/research "):
            text_stripped = text_stripped.split(" ", 1)[1].strip()
            explicit_research = True
            if not text_stripped:
                await self._send_text(
                    client, acct.base_url, acct.token, sender, ctx,
                    "请在 /r 后面写具体问题。例：/r 梳理我对 AI Agent 的看法演化",
                )
                return

        # Automatic routing: complex queries (by rule) go sequential research even without /r
        if explicit_research or _is_complex_query(text_stripped):
            await self._handle_research(
                client, acct, sender, ctx, text_stripped, mode="sequential"
            )
            return

        # Default: single-turn RAG (fast path)
        reply = await self.lm.ask(acct.user_id, text)
        logger.info(f"[{acct.account_id}] ask q={text[:40]!r} → {reply[:80]}")
        await self._send_text(client, acct.base_url, acct.token, sender, ctx, reply)

    async def _handle_spark(
        self, client: httpx.AsyncClient, acct: WechatAccount,
        sender: str, ctx: str, topic: str,
    ):
        """Generate a full article from a topic via /api/articles/spark and push the result."""
        # ack
        await self._send_text(
            client, acct.base_url, acct.token, sender, ctx,
            f"✨ 灵感创作启动：「{topic[:50]}」\n（LLM 写大纲+各章节，约 30-90 秒，完成后会推送链接）",
        )

        result = await self.lm.create_spark(acct.user_id, topic)
        if "error" in result:
            await self._send_text(
                client, acct.base_url, acct.token, sender, ctx,
                f"⚠️ {result['error']}",
            )
            return

        article_id = result.get("id", "")
        title = (result.get("title") or "Untitled").strip()
        # First paragraph of content as preview
        content = (result.get("content") or "").strip()
        preview = ""
        if content:
            # strip leading markdown heading if any
            first_para = next(
                (p.strip() for p in content.split("\n\n") if p.strip() and not p.strip().startswith("#")),
                "",
            )
            preview = first_para[:180] + ("…" if len(first_para) > 180 else "")

        # deep link to /read
        public_base = os.environ.get("TROVE_PUBLIC_BASE", "http://localhost")
        link = f"{public_base}/read/{article_id}" if article_id else ""

        msg = f"✅ 已生成《{title[:50]}》"
        if preview:
            msg += f"\n\n{preview}"
        if link:
            msg += f"\n\n📖 完整阅读：{link}"
        await self._send_text(client, acct.base_url, acct.token, sender, ctx, msg)

    async def _handle_research(
        self, client: httpx.AsyncClient, acct: WechatAccount,
        sender: str, ctx: str, query: str, mode: str = "sequential",
    ):
        """Multi-stage research with progress messages between stages.

        Educational value: user sees the Agent's thinking unfold. In sequential
        mode (4 stages); in tool mode (Agent picks tools each step).
        """
        # Initial ack — wording differs slightly to teach user the distinction
        ack = (
            "🤖 智能体已启动（会自主选工具调用，约 20-40 秒）"
            if mode == "tool"
            else "🔬 研究助理已启动（4 阶段：拆解→检索→综述→自审，约 20-40 秒）"
        )
        await self._send_text(client, acct.base_url, acct.token, sender, ctx, ack)

        STAGE_ICONS = {
            "plan": "🧩", "retrieve": "🔍", "synthesize": "✍️",
            "critique": "🪞", "final": "✅", "error": "⚠️",
            "start": "🚀", "thought": "💭", "tool_call": "🔧", "tool_result": "✓",
        }
        last_stage = ""
        final_data: Optional[dict] = None
        try:
            async for ev in self.lm.research_stream(acct.user_id, query, mode=mode):
                stage = ev.get("stage", "")
                msg = ev.get("message", "")
                if stage == "final":
                    final_data = ev.get("data") or {}
                    continue
                if stage == "error":
                    await self._send_text(
                        client, acct.base_url, acct.token, sender, ctx,
                        f"⚠️ {msg}",
                    )
                    return
                # Only send progress on stage transition or when stage stays same
                # but message is different (e.g. plan: "拆解…" → "拆出 N 个子问题…").
                icon = STAGE_ICONS.get(stage, "•")
                await self._send_text(
                    client, acct.base_url, acct.token, sender, ctx,
                    f"{icon} {msg}",
                )
                last_stage = stage
        except Exception as e:
            logger.exception(f"research stream failed: {e}")
            await self._send_text(
                client, acct.base_url, acct.token, sender, ctx,
                f"⚠️ 研究助理出错：{type(e).__name__}",
            )
            return

        if not final_data or not final_data.get("answer"):
            await self._send_text(
                client, acct.base_url, acct.token, sender, ctx,
                "（没拿到最终结果，请重试）",
            )
            return

        answer = final_data["answer"]
        critique = final_data.get("critique") or ""
        cites = final_data.get("citations") or []
        cite_text = ""
        if cites:
            titles = "、".join((c.get("title", "")[:20]) for c in cites[:5])
            cite_text = f"\n\n📚 参考：{titles}"

        # Send answer (may be 300-500字)
        await self._send_text(
            client, acct.base_url, acct.token, sender, ctx,
            f"✅ 综述：\n\n{answer}{cite_text}",
        )
        if critique:
            await self._send_text(
                client, acct.base_url, acct.token, sender, ctx,
                f"🪞 自我审稿：\n\n{critique}",
            )

    async def _run(self):
        # Per-worker httpx client (long-poll-friendly timeout).
        async with httpx.AsyncClient(timeout=LONGPOLL_TIMEOUT_S + 5) as client:
            backoff = 1.0
            while not self._stop.is_set():
                acct = await self._load()
                if not acct or not acct.is_active:
                    logger.info(f"[{self.account_id}] account gone/inactive — exiting worker")
                    return

                try:
                    r = await client.post(
                        f"{acct.base_url}/ilink/bot/getupdates",
                        headers=_ilink_headers(acct.token),
                        json={"get_updates_buf": acct.sync_cursor or "",
                              "base_info": _base_info()},
                    )
                    r.raise_for_status()
                    resp = r.json()
                    backoff = 1.0
                except httpx.ReadTimeout:
                    continue
                except Exception as e:
                    logger.warning(f"[{acct.account_id}] poll err: {type(e).__name__}: {e}; backoff {backoff}s")
                    await asyncio.sleep(backoff)
                    backoff = min(backoff * 2, 60)
                    continue

                errcode = resp.get("errcode") or resp.get("ret")
                if errcode and errcode != 0:
                    errmsg = resp.get("errmsg") or ""
                    logger.warning(f"[{acct.account_id}] server errcode={errcode} msg={errmsg}")
                    # If token revoked/invalid, give up this worker — supervisor will not respawn
                    # until user re-binds.
                    if errcode in (40001, 42001, 88001):  # heuristic auth-related errors
                        logger.error(f"[{acct.account_id}] auth invalid, marking inactive")
                        async with async_session() as db:
                            await db.execute(
                                update(WechatAccount)
                                .where(WechatAccount.id == acct.id)
                                .values(is_active=False,
                                        unbound_at=datetime.now(timezone.utc))
                            )
                            await db.commit()
                        return
                    await asyncio.sleep(5)
                    continue

                new_cursor = resp.get("get_updates_buf") or acct.sync_cursor or ""
                if new_cursor != (acct.sync_cursor or ""):
                    await self._save_cursor(new_cursor)
                await self._mark_seen()

                for m in (resp.get("msgs") or []):
                    if m.get("message_type") != 1:  # USER only
                        continue
                    try:
                        await self._handle(client, acct, m)
                    except Exception as e:
                        import traceback
                        logger.error(f"[{acct.account_id}] handle err: {e}\n{traceback.format_exc()}")


# ── Supervisor: spawns / culls workers from DB ─────────────────────────
class BotSupervisor:
    REFRESH_INTERVAL_S = 30

    def __init__(self, lm: TroveClient):
        self.lm = lm
        self.workers: Dict[UUID, AccountWorker] = {}
        self._stop = asyncio.Event()

    async def _list_active_ids(self) -> set[UUID]:
        async with async_session() as db:
            r = await db.execute(
                select(WechatAccount.id).where(WechatAccount.is_active.is_(True))
            )
            return {row[0] for row in r.all()}

    async def stop(self):
        self._stop.set()
        for w in list(self.workers.values()):
            await w.stop()
        await self.lm.close()

    async def run(self):
        logger.info("Bot supervisor started")
        while not self._stop.is_set():
            try:
                active = await self._list_active_ids()
                # Spawn new
                for aid in active - self.workers.keys():
                    logger.info(f"Spawning worker for account {aid}")
                    w = AccountWorker(aid, self.lm)
                    w.start()
                    self.workers[aid] = w
                # Cull removed
                for aid in list(self.workers.keys() - active):
                    logger.info(f"Stopping worker for account {aid}")
                    await self.workers[aid].stop()
                    del self.workers[aid]
            except Exception as e:
                logger.exception(f"Supervisor refresh err: {e}")

            try:
                await asyncio.wait_for(self._stop.wait(), timeout=self.REFRESH_INTERVAL_S)
            except asyncio.TimeoutError:
                pass


async def _async_main():
    base = os.environ.get("TROVE_BASE", "http://localhost:8000")
    token = os.environ.get("TROVE_TOKEN", "")
    if not token:
        logger.error("Missing TROVE_TOKEN env (superadmin service token)")
        sys.exit(2)

    sup = BotSupervisor(TroveClient(base, token))
    loop = asyncio.get_event_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, lambda: asyncio.create_task(sup.stop()))
    await sup.run()


def main():
    try:
        asyncio.run(_async_main())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
