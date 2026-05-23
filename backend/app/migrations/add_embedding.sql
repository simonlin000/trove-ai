-- Add embedding column for semantic search
ALTER TABLE articles ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Index for cosine similarity search (ivfflat for performance)
CREATE INDEX IF NOT EXISTS idx_articles_embedding ON articles 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
