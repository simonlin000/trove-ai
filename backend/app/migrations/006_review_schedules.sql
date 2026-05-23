-- ============================================================
-- 006_review_schedules.sql
-- 周期性回顾推送：每个用户一行配置（可启用/停用），cron 扫表到点
-- 生成基于该用户时间窗内文章的 LLM 综述，通过微信 bot 推送。
-- ============================================================

CREATE TABLE IF NOT EXISTS review_schedules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    enabled         BOOLEAN NOT NULL DEFAULT FALSE,
    frequency_days  INTEGER NOT NULL DEFAULT 7,           -- 1=每天 7=每周 30=每月 自定义N
    time_of_day     VARCHAR(5) NOT NULL DEFAULT '09:00',  -- "HH:MM"（24h，上海时区）
    channel         VARCHAR(20) NOT NULL DEFAULT 'wechat',
    next_send_at    TIMESTAMPTZ,                          -- 下一次推送时刻；启用时计算
    last_sent_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 每个用户最多一条回顾配置
CREATE UNIQUE INDEX IF NOT EXISTS uq_review_schedule_user
    ON review_schedules(user_id);
-- cron 高效扫"到点且启用的"
CREATE INDEX IF NOT EXISTS ix_review_due
    ON review_schedules(next_send_at)
    WHERE enabled = TRUE;
