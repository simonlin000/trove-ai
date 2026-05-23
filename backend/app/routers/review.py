"""Review schedule API — user-facing self-service for periodic knowledge digest."""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import ReviewSchedule, User, WechatAccount
from app.services.review_service import compute_next_send_at, generate_review_text

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/review", tags=["review"])


class ScheduleIn(BaseModel):
    enabled: bool = False
    frequency_days: int = Field(default=7, ge=1, le=90)
    time_of_day: str = Field(default="09:00", pattern=r"^\d{2}:\d{2}$")

    @field_validator("time_of_day")
    @classmethod
    def valid_time(cls, v: str) -> str:
        try:
            hh, mm = v.split(":")
            if not (0 <= int(hh) <= 23 and 0 <= int(mm) <= 59):
                raise ValueError()
        except Exception:
            raise ValueError("time_of_day must be HH:MM in 24h")
        return v


class ScheduleOut(BaseModel):
    enabled: bool
    frequency_days: int
    time_of_day: str
    next_send_at: Optional[datetime] = None
    last_sent_at: Optional[datetime] = None
    has_wechat_binding: bool


class CitationOut(BaseModel):
    idx: int
    id: str
    title: str


class PreviewOut(BaseModel):
    text: Optional[str]
    article_count: int
    citations: list[CitationOut] = []
    message: Optional[str] = None


@router.get("/schedule", response_model=ScheduleOut)
async def get_schedule(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the current user's review config (defaults if none)."""
    r = await db.execute(
        select(ReviewSchedule).where(ReviewSchedule.user_id == current_user.id)
    )
    s = r.scalar_one_or_none()

    wb = await db.execute(
        select(WechatAccount.id).where(
            WechatAccount.user_id == current_user.id, WechatAccount.is_active.is_(True)
        )
    )
    has_wechat = wb.scalar_one_or_none() is not None

    if not s:
        return ScheduleOut(
            enabled=False,
            frequency_days=7,
            time_of_day="09:00",
            has_wechat_binding=has_wechat,
        )
    return ScheduleOut(
        enabled=s.enabled,
        frequency_days=s.frequency_days,
        time_of_day=s.time_of_day,
        next_send_at=s.next_send_at,
        last_sent_at=s.last_sent_at,
        has_wechat_binding=has_wechat,
    )


@router.put("/schedule", response_model=ScheduleOut)
async def update_schedule(
    body: ScheduleIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create or update the current user's review config. Computes next_send_at when enabling."""
    r = await db.execute(
        select(ReviewSchedule).where(ReviewSchedule.user_id == current_user.id)
    )
    s = r.scalar_one_or_none()

    next_at = compute_next_send_at(body.frequency_days, body.time_of_day) if body.enabled else None

    if s is None:
        s = ReviewSchedule(
            user_id=current_user.id,
            enabled=body.enabled,
            frequency_days=body.frequency_days,
            time_of_day=body.time_of_day,
            next_send_at=next_at,
        )
        db.add(s)
    else:
        s.enabled = body.enabled
        s.frequency_days = body.frequency_days
        s.time_of_day = body.time_of_day
        # Recompute next_send_at when enabling or freq/time changes. Preserve when disabling.
        if body.enabled:
            s.next_send_at = next_at
        else:
            s.next_send_at = None
    await db.commit()
    await db.refresh(s)

    wb = await db.execute(
        select(WechatAccount.id).where(
            WechatAccount.user_id == current_user.id, WechatAccount.is_active.is_(True)
        )
    )
    has_wechat = wb.scalar_one_or_none() is not None

    return ScheduleOut(
        enabled=s.enabled,
        frequency_days=s.frequency_days,
        time_of_day=s.time_of_day,
        next_send_at=s.next_send_at,
        last_sent_at=s.last_sent_at,
        has_wechat_binding=has_wechat,
    )


@router.post("/preview", response_model=PreviewOut)
async def preview_review(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a review preview NOW (no push). Window = last 7 days by default."""
    # Use the saved frequency if any, else default 7
    r = await db.execute(
        select(ReviewSchedule).where(ReviewSchedule.user_id == current_user.id)
    )
    s = r.scalar_one_or_none()
    freq = s.frequency_days if s else 7
    since = datetime.now(timezone.utc) - timedelta(days=freq)

    from app.models import Article
    cnt_r = await db.execute(
        select(Article.id).where(Article.user_id == current_user.id, Article.created_at >= since)
    )
    count = len(cnt_r.all())

    if count == 0:
        return PreviewOut(
            text=None,
            article_count=0,
            message=f"过去 {freq} 天没有新收藏，没东西可回顾",
        )

    text, cite_map = await generate_review_text(db, current_user.id, since, freq)
    return PreviewOut(
        text=text,
        article_count=count,
        citations=[CitationOut(**c) for c in cite_map],
    )
