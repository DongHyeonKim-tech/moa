export const SCHEMA_VERSION = 1;

export const MIGRATION_V1 = `
CREATE TABLE IF NOT EXISTS memos (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  ai_summary TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_viewed_at TEXT,
  analyzed_content_hash TEXT,
  ai_analysis_status TEXT NOT NULL,
  CHECK (ai_analysis_status IN ('idle', 'pending', 'done', 'failed', 'skipped'))
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS memo_tags (
  memo_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  source TEXT NOT NULL,
  PRIMARY KEY (memo_id, tag_id, source),
  CHECK (source IN ('USER', 'AI')),
  FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS memo_relations (
  id TEXT PRIMARY KEY NOT NULL,
  source_memo_id TEXT NOT NULL,
  target_memo_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (source_memo_id, target_memo_id, relation_type),
  CHECK (relation_type IN ('LINK'))
);

CREATE TABLE IF NOT EXISTS memo_sources (
  merged_memo_id TEXT NOT NULL,
  source_memo_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (merged_memo_id, source_memo_id)
);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY NOT NULL,
  memo_id TEXT NOT NULL,
  local_uri TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memos_updated_at ON memos(updated_at);
CREATE INDEX IF NOT EXISTS idx_memos_deleted ON memos(is_deleted);
CREATE INDEX IF NOT EXISTS idx_memo_tags_tag_id ON memo_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_relations_source ON memo_relations(source_memo_id);
CREATE INDEX IF NOT EXISTS idx_relations_target ON memo_relations(target_memo_id);
CREATE INDEX IF NOT EXISTS idx_attachments_memo ON attachments(memo_id);
CREATE INDEX IF NOT EXISTS idx_sources_source ON memo_sources(source_memo_id);
`;
