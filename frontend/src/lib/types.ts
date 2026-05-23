// Trove AI Type Definitions

export interface Tag {
  id: string;
  name: string;
  color: string;
  is_ai_generated: boolean;
  description?: string;
}

export interface TagWithCount extends Tag {
  article_count: number;
}

export interface Folder {
  id: string;
  name: string;
  parent_id?: string;
  color: string;
  icon: string;
}

export interface Article {
  id: string;
  title: string;
  url?: string;
  content_type?: 'article' | 'note';
  source_platform?: string;
  author?: string;
  published_at?: string;
  summary?: string;
  key_points?: string[];
  reading_time: number;
  word_count: number;
  cover_image?: string;
  status: 'unread' | 'reading' | 'completed' | 'archived';
  fetch_status?: 'completed' | 'pending_agent' | 'failed';
  is_favorited: boolean;
  folder_id?: string;
  tags: Tag[];
  folder?: Folder;
  created_at?: string;
  updated_at?: string;
}

export interface ArticleDetail extends Article {
  clean_content?: string;
  raw_content?: string;
}

export interface ArticleListResponse {
  items: Article[];
  total: number;
  page: number;
  page_size: number;
}

export interface KnowledgeEdge {
  id: string;
  source: string;
  target: string;
  relation_type: string;
  relation_desc?: string;
  weight: number;
}

export interface GraphNode {
  id: string;
  title: string;
  summary?: string;
  tags: string[];
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: KnowledgeEdge[];
}

export interface LearningPath {
  id: string;
  title: string;
  description?: string;
  topic?: string;
  articles_order: string[];
  progress: number;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface LearningPathDetail extends LearningPath {
  articles: Article[];
}

export interface Stats {
  total_articles: number;
  unread: number;
  completed: number;
  favorites: number;
  total_tags: number;
  total_edges: number;
  total_paths: number;
}

export interface SparkSection {
  heading: string;
  key_points: string[];
  content: string;
}

export interface SparkResponse {
  id: string;
  title: string;
  content: string;
  sections: SparkSection[];
  steps_completed: string[];
  status: string;
}

export interface RelatedArticleGroup {
  relation_type: string;
  relation_label: string;
  articles: {
    id: string;
    title: string;
    summary: string;
    relation_desc: string;
  }[];
}

export interface RelatedArticlesResponse {
  article_id: string;
  groups: RelatedArticleGroup[];
}

export interface AskRequest {
  question: string;
  top_k?: number;
}

export interface Citation {
  article_id: string;
  title: string;
  chunk: string;
  relevance_score: number;
}

export interface AskResponse {
  answer: string;
  citations: Citation[];
}

export interface MindMapNode {
  label: string;
  children: MindMapNode[];
}

// Note: API returns mindmap_data as the root MindMapNode directly (not wrapped in {root}).
// The MindMapNode structure has {label, children} which is the root node itself.
export interface MindMapData extends MindMapNode {}

export interface MindMapResponse {
  mindmap_data: MindMapNode | null;
  cached: boolean;
  article_title?: string;
}

// ─── Auth ──────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  is_super_admin: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}