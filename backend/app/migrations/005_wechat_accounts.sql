-- ============================================================
-- 005_wechat_accounts.sql
-- 多用户自助绑定微信 bot 凭证存储。每个 Trove AI 用户最多一个 active 微信账号；
-- 解绑后保留行，is_active=false，方便审计 / 重新绑定时插入新行。
-- ============================================================

CREATE TABLE IF NOT EXISTS wechat_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id      VARCHAR(64) NOT NULL,         -- ilink_bot_id；同时也是 openclaw 本地目录名
    wechat_user_id  VARCHAR(100),                  -- ilink_user_id（扫码的微信用户）
    token           VARCHAR(500) NOT NULL,         -- ilink bot_token
    base_url        VARCHAR(200) NOT NULL DEFAULT 'https://ilinkai.weixin.qq.com',
    display_name    VARCHAR(200),                  -- 微信昵称，绑定时若 ilinkai 没返就 NULL
    is_active       BOOLEAN DEFAULT TRUE,
    last_seen_at    TIMESTAMPTZ,                   -- 上次成功 long-poll 时间，用户感知"bot 还活着吗"
    sync_cursor     TEXT,                          -- get_updates_buf，长轮询游标
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    unbound_at      TIMESTAMPTZ
);

-- 每个用户同时只能有一个 active 微信账号
CREATE UNIQUE INDEX IF NOT EXISTS uq_wechat_active_user
    ON wechat_accounts(user_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS ix_wechat_active
    ON wechat_accounts(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS ix_wechat_account_id ON wechat_accounts(account_id);
