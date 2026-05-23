-- Add note support: introduce content_type and allow null url for notes.

-- 1) Add content_type column (default 'article' so existing rows stay valid).
ALTER TABLE articles
    ADD COLUMN IF NOT EXISTS content_type VARCHAR(20) NOT NULL DEFAULT 'article';

-- 2) Allow url to be NULL (notes have no source URL).
ALTER TABLE articles
    ALTER COLUMN url DROP NOT NULL;

-- 3) Index for filtering by type (cheap, optional).
CREATE INDEX IF NOT EXISTS idx_articles_user_type ON articles (user_id, content_type);
