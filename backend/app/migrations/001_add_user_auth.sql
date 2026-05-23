-- Migration: Add user_id to all content tables for multi-tenant data isolation
-- Also create the superadmin user (weaiw / Aa41312432)
-- Run by init_db() on startup via database.py
-- Also safe for docker-entrypoint-initdb.d (first-run only)

-- Step 0: Create users table if not exists (needed for docker-entrypoint-initdb.d first run)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_super_admin BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 1: Add user_id columns (nullable first)
ALTER TABLE articles ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE folders ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE learning_paths ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE knowledge_edges ADD COLUMN IF NOT EXISTS user_id UUID;

-- Step 2: Insert superadmin user (only if not exists)
-- bcrypt hash of 'Aa41312432' — generated with passlib
INSERT INTO users (id, username, password_hash, is_super_admin, is_active, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    'weaiw',
    '$2b$12$Onv2NjL9Bx0yL4dtv0z4uOj6NGCm6kiouNZWupAZD.bH.dJbgfapa',
    true,
    true,
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'weaiw');

-- Step 3: Assign all existing data to the superadmin
DO $$
DECLARE
    admin_id UUID;
BEGIN
    SELECT id INTO admin_id FROM users WHERE username = 'weaiw';
    IF admin_id IS NOT NULL THEN
        UPDATE articles SET user_id = admin_id WHERE user_id IS NULL;
        UPDATE tags SET user_id = admin_id WHERE user_id IS NULL;
        UPDATE folders SET user_id = admin_id WHERE user_id IS NULL;
        UPDATE learning_paths SET user_id = admin_id WHERE user_id IS NULL;
        UPDATE knowledge_edges SET user_id = admin_id WHERE user_id IS NULL;
    END IF;
END $$;

-- Step 4: Make user_id NOT NULL (after data is populated)
ALTER TABLE articles ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE tags ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE folders ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE learning_paths ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE knowledge_edges ALTER COLUMN user_id SET NOT NULL;

-- Step 5: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_articles_user_id ON articles(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_paths_user_id ON learning_paths(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_user_id ON knowledge_edges(user_id);
