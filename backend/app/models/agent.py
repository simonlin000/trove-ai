"""External-integration models: WeChat bot bindings + scheduled review pushes.

(Historically this file also held Agent/AgentTask for the local-fetch proxy
mechanism; that's been removed in the OSS branch — direct fetching from the
deployment's own IP works for the bundled platforms.)
"""
from sqlalchemy import Column, String, Text, Integer, DateTime, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.database import Base


class ReviewSchedule(Base):
    """Per-user periodic review push config.

    One row per user (enforced by unique index). Disabled by default; cron
    scans `next_send_at <= now() AND enabled=true` to fire pushes through the
    user's bound wechat_account.
    """
    __tablename__ = 'review_schedules'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    enabled = Column(Boolean, nullable=False, default=False)
    frequency_days = Column(Integer, nullable=False, default=7)
    time_of_day = Column(String(5), nullable=False, default='09:00')  # HH:MM 24h Asia/Shanghai
    channel = Column(String(20), nullable=False, default='wechat')
    next_send_at = Column(DateTime(timezone=True))
    last_sent_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class WechatAccount(Base):
    """Per-user bound WeChat bot credentials.

    Each user has at most one row where is_active=True (enforced by partial
    unique index). Unbind sets is_active=False; history is retained for audit.
    """
    __tablename__ = 'wechat_accounts'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    account_id = Column(String(64), nullable=False)
    wechat_user_id = Column(String(100))
    token = Column(String(500), nullable=False)
    base_url = Column(String(200), nullable=False, default='https://ilinkai.weixin.qq.com')
    display_name = Column(String(200))
    is_active = Column(Boolean, default=True)
    last_seen_at = Column(DateTime(timezone=True))
    sync_cursor = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    unbound_at = Column(DateTime(timezone=True))
