"""Users management router — superadmin only."""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.dependencies import require_superadmin, hash_password

router = APIRouter(prefix="/api/users", tags=["users"])


# ── Schemas ─────────────────────────────────────────────────
class UserCreateRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=100)
    password: str = Field(..., min_length=6, max_length=100)


class UserUpdateRequest(BaseModel):
    username: str | None = Field(None, min_length=2, max_length=100)
    password: str | None = Field(None, min_length=6, max_length=100)
    is_active: bool | None = None


class UserResponse(BaseModel):
    id: str
    username: str
    is_super_admin: bool
    is_active: bool
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    items: List[UserResponse]
    total: int


# ── Routes ──────────────────────────────────────────────────
@router.get("", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    _super: User = Depends(require_superadmin),
):
    """List all users (superadmin only)."""
    query = select(User)
    count_query = select(func.count(User.id))

    if search:
        filter_clause = User.username.ilike(f"%{search}%")
        query = query.where(filter_clause)
        count_query = count_query.where(filter_clause)

    # Total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Page
    offset = (page - 1) * page_size
    query = query.order_by(User.created_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    users = result.scalars().all()

    items = [
        UserResponse(
            id=str(u.id),
            username=u.username,
            is_super_admin=u.is_super_admin,
            is_active=u.is_active,
            created_at=str(u.created_at) if u.created_at else "",
            updated_at=str(u.updated_at) if u.updated_at else "",
        )
        for u in users
    ]

    return UserListResponse(items=items, total=total)


@router.post("", response_model=UserResponse, status_code=201)
async def create_user(
    body: UserCreateRequest,
    db: AsyncSession = Depends(get_db),
    _super: User = Depends(require_superadmin),
):
    """Create a new user (superadmin only)."""
    # Check uniqueness
    existing = await db.execute(
        select(User).where(User.username == body.username)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="用户名已存在",
        )

    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
        is_super_admin=False,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return UserResponse(
        id=str(user.id),
        username=user.username,
        is_super_admin=user.is_super_admin,
        is_active=user.is_active,
        created_at=str(user.created_at) if user.created_at else "",
        updated_at=str(user.updated_at) if user.updated_at else "",
    )


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    body: UserUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _super: User = Depends(require_superadmin),
):
    """Update user — enable/disable, change password, rename (superadmin only)."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    # Prevent disabling yourself
    if body.is_active is False and user.id == _super.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能停用自己的账号",
        )

    if body.username is not None:
        # Check uniqueness
        existing = await db.execute(
            select(User).where(
                User.username == body.username,
                User.id != user_id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="用户名已存在",
            )
        user.username = body.username

    if body.password is not None:
        user.password_hash = hash_password(body.password)

    if body.is_active is not None:
        user.is_active = body.is_active

    await db.commit()
    await db.refresh(user)

    return UserResponse(
        id=str(user.id),
        username=user.username,
        is_super_admin=user.is_super_admin,
        is_active=user.is_active,
        created_at=str(user.created_at) if user.created_at else "",
        updated_at=str(user.updated_at) if user.updated_at else "",
    )


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    _super: User = Depends(require_superadmin),
):
    """Delete a user (superadmin only). Cannot delete self."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    if user.id == _super.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能删除自己的账号",
        )

    if user.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能删除超级管理员账号",
        )

    await db.delete(user)
    await db.commit()
