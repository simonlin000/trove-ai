-- Add embedding column for semantic search
-- 512-dim: fastembed BAAI/bge-small-zh-v1.5 (Chinese). See migration 008.
ALTER TABLE articles ADD COLUMN IF NOT EXISTS embedding vector(512);

-- Index for cosine similarity search (ivfflat for performance)
CREATE INDEX IF NOT EXISTS idx_articles_embedding ON articles 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
