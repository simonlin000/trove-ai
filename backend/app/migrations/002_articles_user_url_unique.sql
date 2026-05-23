-- Allow different users to add the same article URL.
-- Replace the global unique(url) with a composite unique(user_id, url).

-- 1) Drop the auto-generated single-column unique constraint on url.
--    Postgres names it <table>_<col>_key for SQLAlchemy's unique=True.
ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_url_key;

-- 2) Add composite unique (user_id, url). NULL user_id is treated as distinct,
--    so legacy rows without a user remain non-conflicting.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_articles_user_url'
          AND conrelid = 'articles'::regclass
    ) THEN
        ALTER TABLE articles ADD CONSTRAINT uq_articles_user_url UNIQUE (user_id, url);
    END IF;
END $$;
