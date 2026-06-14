-- Switch semantic-search embeddings to a Chinese local model (BAAI/bge-small-zh-v1.5, 512-dim).
-- The old column was vector(384) populated by an English-only model, which made
-- Chinese-content retrieval near-random ("材料不全" even when the answer was in the库).
--
-- This migration is idempotent: it only fires when the column is NOT already vector(512).
-- When it fires it clears all existing vectors (they are the wrong dimension AND from the
-- wrong model); the auto-backfill task then regenerates them with the new model.
DO $$
DECLARE
    cur_type text;
BEGIN
    SELECT format_type(atttypid, atttypmod) INTO cur_type
    FROM pg_attribute
    WHERE attrelid = 'articles'::regclass
      AND attname = 'embedding'
      AND NOT attisdropped;

    IF cur_type IS DISTINCT FROM 'vector(512)' THEN
        DROP INDEX IF EXISTS idx_articles_embedding;
        ALTER TABLE articles ALTER COLUMN embedding TYPE vector(512) USING NULL;
        CREATE INDEX idx_articles_embedding ON articles
            USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
        RAISE NOTICE 'embedding column migrated to vector(512); old vectors cleared for re-backfill';
    END IF;
END $$;
