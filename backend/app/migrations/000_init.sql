-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tables
CREATE TABLE IF NOT EXISTS folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    color VARCHAR(7) DEFAULT '#007aff',
    icon VARCHAR(50) DEFAULT 'folder',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    color VARCHAR(7) DEFAULT '#007aff',
    is_ai_generated BOOLEAN DEFAULT TRUE,
    description VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    url VARCHAR(2048) UNIQUE NOT NULL,
    source_platform VARCHAR(100),
    author VARCHAR(255),
    published_at TIMESTAMP WITH TIME ZONE,
    raw_content TEXT,
    clean_content TEXT,
    plain_text TEXT,
    summary TEXT,
    key_points JSONB DEFAULT '[]',
    reading_time INTEGER DEFAULT 0,
    word_count INTEGER DEFAULT 0,
    cover_image VARCHAR(2048),
    status VARCHAR(20) DEFAULT 'unread',
    is_favorited BOOLEAN DEFAULT FALSE,
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS article_tags (
    article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (article_id, tag_id)
);

CREATE TABLE IF NOT EXISTS knowledge_edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_article_id UUID REFERENCES articles(id) ON DELETE CASCADE NOT NULL,
    target_article_id UUID REFERENCES articles(id) ON DELETE CASCADE NOT NULL,
    relation_type VARCHAR(50) DEFAULT 'related',
    relation_desc VARCHAR(500),
    weight FLOAT DEFAULT 0.5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(source_article_id, target_article_id)
);

CREATE TABLE IF NOT EXISTS learning_paths (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    topic VARCHAR(255),
    articles_order JSONB DEFAULT '[]',
    progress FLOAT DEFAULT 0.0,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_folder ON articles(folder_id);
CREATE INDEX IF NOT EXISTS idx_articles_created ON articles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source_platform);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_source ON knowledge_edges(source_article_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_target ON knowledge_edges(target_article_id);
CREATE INDEX IF NOT EXISTS idx_learning_paths_topic ON learning_paths(topic);

-- Full text search index
CREATE INDEX IF NOT EXISTS idx_articles_fts ON articles USING gin(to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(plain_text,'')));

-- Insert default tags
INSERT INTO tags (name, color, is_ai_generated, description) VALUES
    ('AI/机器学习', '#007aff', TRUE, '人工智能和机器学习相关'),
    ('编程技术', '#34c759', TRUE, '编程语言和软件开发'),
    ('产品设计', '#ff9500', TRUE, '产品管理和设计'),
    ('商业思维', '#ff3b30', TRUE, '商业策略和创业'),
    ('科技资讯', '#5856d6', TRUE, '科技行业动态'),
    ('人文社科', '#ff2d55', TRUE, '人文社科类内容'),
    ('生活健康', '#af52de', TRUE, '生活健康相关')
ON CONFLICT (name) DO NOTHING;
