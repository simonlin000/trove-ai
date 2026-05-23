"""Authentication dependencies — JWT token creation, verification, and user guards."""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User

# ── Crypto ──────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = os.getenv("SECRET_KEY", "trove-secret-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# Service tokens — long-lived bearer creds for trusted server-to-server callers
# (e.g. the WeChat bot). Each token maps to a single username.
# Format env var: SERVICE_TOKENS="tokenA:userA,tokenB:userB"
_SERVICE_TOKENS: dict[str, str] = {
    pair.split(":", 1)[0].strip(): pair.split(":", 1)[1].strip()
    for pair in os.getenv("SERVICE_TOKENS", "").split(",")
    if ":" in pair
}

bearer_scheme = HTTPBearer(auto_error=False)


# ── Password helpers ────────────────────────────────────────
def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# ── JWT helpers ─────────────────────────────────────────────
def create_access_token(user_id: UUID, username: str, is_super_admin: bool) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": str(user_id),
        "username": username,
        "is_super_admin": is_super_admin,
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_long_lived_token(
    user_id: UUID,
    username: str,
    is_super_admin: bool,
    purpose: str = "sync",
    expires_days: int = 365,
    token_version: int = 0,
) -> str:
    """Mint a long-lived JWT for a specific purpose (e.g. Obsidian sync agent).

    The `token_version` is User.sync_token_version at signing time. Bumping
    that counter (via POST /api/sync/revoke-all-tokens) invalidates every
    previously-issued token in one shot, since `get_current_user` rejects
    purpose=sync* tokens whose `tv` doesn't match the user's current value.
    """
    expire = datetime.now(timezone.utc) + timedelta(days=expires_days)
    payload = {
        "sub": str(user_id),
        "username": username,
        "is_super_admin": is_super_admin,
        "purpose": purpose,
        "tv": token_version,
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


# Purposes that participate in the revocation check. Login JWTs have no
# `purpose` field (or any other value) and skip the version gate.
REVOCABLE_PURPOSES = {"obsidian-sync", "sync"}


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="登录已过期，请重新登录",
        )


# ── Dependency: get current user ────────────────────────────
async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    x_act_as_user: Optional[str] = Header(default=None, alias="X-Act-As-User"),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate the current user from the JWT token.
    
    Raises 401 if token is missing or invalid, or if user is inactive/deleted.
    """
    if not credentials:
        # No token — return first active user as default (browser direct API calls)
        result = await db.execute(
            select(User).where(User.is_active == True).order_by(User.created_at).limit(1)
        )
        default_user = result.scalar_one_or_none()
        if default_user:
            return default_user
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="请先登录",
        )

    async def _maybe_impersonate(principal: User) -> User:
        """If principal is superadmin AND X-Act-As-User is set, return that user
        instead. Service tokens (used by wechat-bot) and JWT-authed superadmins
        both go through this path so impersonation works in both cases."""
        if not x_act_as_user or not principal.is_super_admin:
            return principal
        try:
            target_id = UUID(x_act_as_user)
        except ValueError:
            raise HTTPException(status_code=400, detail="X-Act-As-User must be UUID")
        r = await db.execute(select(User).where(User.id == target_id, User.is_active == True))
        target = r.scalar_one_or_none()
        if not target:
            raise HTTPException(status_code=404, detail="Act-as target user not found")
        return target

    # Service token: long-lived bearer credentials mapped to a specific user.
    bound_username = _SERVICE_TOKENS.get(credentials.credentials)
    if bound_username:
        result = await db.execute(
            select(User).where(User.username == bound_username, User.is_active == True)
        )
        bound_user = result.scalar_one_or_none()
        if not bound_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Service token user not found or inactive",
            )
        return await _maybe_impersonate(bound_user)

    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的登录凭证",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账号已被停用，请联系管理员",
        )

    # Revocation check for long-lived sync tokens: the JWT must carry the same
    # `tv` (sync_token_version) the user currently has. Login JWTs lack a
    # `purpose` field and bypass this check entirely.
    purpose = payload.get("purpose")
    if purpose in REVOCABLE_PURPOSES:
        token_version = payload.get("tv", 0)
        current_version = user.sync_token_version or 0
        if token_version != current_version:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="同步 Token 已被撤销，请到设置页重新生成",
            )

    return await _maybe_impersonate(user)


# ── Dependency: require super admin ─────────────────────────
async def require_superadmin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Only allow super admin users."""
    if not current_user.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="仅超级管理员可执行此操作",
        )
    return current_user


# ── Optional user (for public endpoints that optionally need user context) ──
async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Like get_current_user but returns None instead of raising 401."""
    if not credentials:
        return None
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = payload.get("sub")
        if user_id:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if user and user.is_active:
                return user
    except HTTPException:
        pass
    return None
