import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';

import { MIGRATION_V1, SCHEMA_VERSION } from '@/repositories/schema';
import { legacyMemoList } from '@/services/legacyMemo';
import { parseAnalysisStatus } from '@/services/legacyMemo';
import { tagKey } from '@/services/tagPolicy';
import type { Attachment, Memo, MemoGraph, MemoRelation, MemoSource, MemoTag, TagSource } from '@/types/memo';

const LEGACY_STORAGE_KEY = 'moa.memos.v1';

export type MemoRepository = {
  loadGraph: () => Promise<MemoGraph>;
  saveMemo: (memo: Memo) => Promise<void>;
  deleteMemo: (id: string) => Promise<string[]>;
  deleteTrashed: () => Promise<string[]>;
  saveRelation: (relation: MemoRelation) => Promise<void>;
  deleteRelation: (id: string) => Promise<void>;
  createMerged: (memo: Memo, sources: readonly MemoSource[]) => Promise<void>;
  saveAttachment: (attachment: Attachment) => Promise<void>;
  deleteAttachment: (id: string) => Promise<void>;
};

type MemoRow = {
  id: string;
  title: string;
  content_markdown: string;
  ai_summary: string | null;
  is_favorite: number | boolean;
  is_pinned: number | boolean;
  is_deleted: number | boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  last_viewed_at: string | null;
  analyzed_content_hash: string | null;
  ai_analysis_status: string;
};

type TagRow = { memo_id: string; name: string; source: string };
type RelationRow = {
  id: string;
  source_memo_id: string;
  target_memo_id: string;
  relation_type: string;
  created_at: string;
};
type SourceRow = { merged_memo_id: string; source_memo_id: string; position: number };
type AttachmentRow = { id: string; memo_id: string; local_uri: string; mime_type: string; created_at: string };

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openDatabase();
  }
  return databasePromise;
}

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('moa.db');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY NOT NULL);');
  const row = await db.getFirstAsync<{ version: number | null }>('SELECT MAX(version) AS version FROM schema_migrations');
  const version = row?.version ?? 0;
  if (version < SCHEMA_VERSION) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATION_V1);
      await db.runAsync('INSERT INTO schema_migrations (version) VALUES (?)', SCHEMA_VERSION);
    });
  }
  await importLegacyMemos(db);
  return db;
}

async function importLegacyMemos(db: SQLite.SQLiteDatabase): Promise<void> {
  const marker = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_meta WHERE key = 'legacy_imported'",
  );
  if (marker) {
    return;
  }

  let memos: Memo[] = [];
  try {
    const raw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) {
      memos = legacyMemoList(JSON.parse(raw) as unknown);
    }
  } catch {
    memos = [];
  }

  await db.withTransactionAsync(async () => {
    for (const memo of memos) {
      await writeMemo(db, memo);
    }
    await db.runAsync("INSERT INTO app_meta (key, value) VALUES ('legacy_imported', '1')");
  });
}

async function writeMemo(db: SQLite.SQLiteDatabase, memo: Memo): Promise<void> {
  await db.runAsync(
    `INSERT INTO memos (
      id, title, content_markdown, ai_summary, is_favorite, is_pinned, is_deleted,
      deleted_at, created_at, updated_at, last_viewed_at, analyzed_content_hash, ai_analysis_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      content_markdown = excluded.content_markdown,
      ai_summary = excluded.ai_summary,
      is_favorite = excluded.is_favorite,
      is_pinned = excluded.is_pinned,
      is_deleted = excluded.is_deleted,
      deleted_at = excluded.deleted_at,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      last_viewed_at = excluded.last_viewed_at,
      analyzed_content_hash = excluded.analyzed_content_hash,
      ai_analysis_status = excluded.ai_analysis_status`,
    memo.id,
    memo.title,
    memo.contentMarkdown,
    memo.aiSummary,
    memo.isFavorite ? 1 : 0,
    memo.isPinned ? 1 : 0,
    memo.isDeleted ? 1 : 0,
    memo.deletedAt,
    memo.createdAt,
    memo.updatedAt,
    memo.lastViewedAt,
    memo.analyzedContentHash,
    memo.aiAnalysisStatus,
  );

  await db.runAsync('DELETE FROM memo_tags WHERE memo_id = ?', memo.id);
  for (const tag of memo.tags) {
    const key = tagKey(tag.name);
    if (!key) {
      continue;
    }
    await db.runAsync(
      `INSERT INTO tags (id, name, normalized_name) VALUES (?, ?, ?)
       ON CONFLICT(normalized_name) DO NOTHING`,
      key,
      tag.name,
      key,
    );
    await db.runAsync(
      'INSERT OR IGNORE INTO memo_tags (memo_id, tag_id, source) VALUES (?, ?, ?)',
      memo.id,
      key,
      tag.source,
    );
  }
  await db.runAsync('DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM memo_tags)');
}

function mapMemo(row: MemoRow, tags: readonly MemoTag[]): Memo {
  return {
    id: row.id,
    title: row.title,
    contentMarkdown: row.content_markdown,
    aiSummary: row.ai_summary,
    tags: [...tags],
    isFavorite: row.is_favorite === 1 || row.is_favorite === true,
    isPinned: row.is_pinned === 1 || row.is_pinned === true,
    isDeleted: row.is_deleted === 1 || row.is_deleted === true,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastViewedAt: row.last_viewed_at,
    analyzedContentHash: row.analyzed_content_hash,
    aiAnalysisStatus: parseAnalysisStatus(row.ai_analysis_status),
  };
}

async function attachmentUris(db: SQLite.SQLiteDatabase, memoId: string): Promise<string[]> {
  const rows = await db.getAllAsync<{ local_uri: string }>('SELECT local_uri FROM attachments WHERE memo_id = ?', memoId);
  return rows.map((row) => row.local_uri);
}

async function removeMemoRows(db: SQLite.SQLiteDatabase, memoId: string): Promise<void> {
  await db.runAsync('DELETE FROM memo_relations WHERE source_memo_id = ? OR target_memo_id = ?', memoId, memoId);
  await db.runAsync('DELETE FROM memo_sources WHERE merged_memo_id = ? OR source_memo_id = ?', memoId, memoId);
  await db.runAsync('DELETE FROM attachments WHERE memo_id = ?', memoId);
  await db.runAsync('DELETE FROM memo_tags WHERE memo_id = ?', memoId);
  await db.runAsync('DELETE FROM memos WHERE id = ?', memoId);
  await db.runAsync('DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM memo_tags)');
}

export const sqliteMemoRepository: MemoRepository = {
  async loadGraph() {
    const db = await getDatabase();
    const memoRows = await db.getAllAsync<MemoRow>('SELECT * FROM memos ORDER BY updated_at DESC');
    const tagRows = await db.getAllAsync<TagRow>(
      `SELECT memo_tags.memo_id, tags.name, memo_tags.source
       FROM memo_tags JOIN tags ON tags.id = memo_tags.tag_id`,
    );
    const relationRows = await db.getAllAsync<RelationRow>('SELECT * FROM memo_relations');
    const sourceRows = await db.getAllAsync<SourceRow>('SELECT * FROM memo_sources ORDER BY position ASC');
    const attachmentRows = await db.getAllAsync<AttachmentRow>('SELECT * FROM attachments');

    const tagsByMemo = new Map<string, MemoTag[]>();
    for (const row of tagRows) {
      const source: TagSource = row.source === 'AI' ? 'AI' : 'USER';
      const list = tagsByMemo.get(row.memo_id) ?? [];
      list.push({ name: row.name, source });
      tagsByMemo.set(row.memo_id, list);
    }

    return {
      memos: memoRows.map((row) => mapMemo(row, tagsByMemo.get(row.id) ?? [])),
      relations: relationRows
        .filter((row) => row.relation_type === 'LINK')
        .map((row) => ({
          id: row.id,
          sourceMemoId: row.source_memo_id,
          targetMemoId: row.target_memo_id,
          relationType: 'LINK' as const,
          createdAt: row.created_at,
        })),
      sources: sourceRows.map((row) => ({
        mergedMemoId: row.merged_memo_id,
        sourceMemoId: row.source_memo_id,
        position: row.position,
      })),
      attachments: attachmentRows.map((row) => ({
        id: row.id,
        memoId: row.memo_id,
        localUri: row.local_uri,
        mimeType: row.mime_type,
        createdAt: row.created_at,
      })),
    };
  },

  async saveMemo(memo) {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      await writeMemo(db, memo);
    });
  },

  async deleteMemo(id) {
    const db = await getDatabase();
    const uris = await attachmentUris(db, id);
    await db.withTransactionAsync(async () => {
      await removeMemoRows(db, id);
    });
    return uris;
  },

  async deleteTrashed() {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ id: string }>('SELECT id FROM memos WHERE is_deleted = 1');
    const uris: string[] = [];
    for (const row of rows) {
      uris.push(...(await attachmentUris(db, row.id)));
    }
    await db.withTransactionAsync(async () => {
      for (const row of rows) {
        await removeMemoRows(db, row.id);
      }
    });
    return uris;
  },

  async saveRelation(relation) {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT OR IGNORE INTO memo_relations (id, source_memo_id, target_memo_id, relation_type, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      relation.id,
      relation.sourceMemoId,
      relation.targetMemoId,
      relation.relationType,
      relation.createdAt,
    );
  },

  async deleteRelation(id) {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM memo_relations WHERE id = ?', id);
  },

  async createMerged(memo, sources) {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      await writeMemo(db, memo);
      await db.runAsync('DELETE FROM memo_sources WHERE merged_memo_id = ?', memo.id);
      for (const source of sources) {
        await db.runAsync(
          'INSERT INTO memo_sources (merged_memo_id, source_memo_id, position) VALUES (?, ?, ?)',
          source.mergedMemoId,
          source.sourceMemoId,
          source.position,
        );
      }
    });
  },

  async saveAttachment(attachment) {
    const db = await getDatabase();
    await db.runAsync(
      'INSERT OR REPLACE INTO attachments (id, memo_id, local_uri, mime_type, created_at) VALUES (?, ?, ?, ?, ?)',
      attachment.id,
      attachment.memoId,
      attachment.localUri,
      attachment.mimeType,
      attachment.createdAt,
    );
  },

  async deleteAttachment(id) {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM attachments WHERE id = ?', id);
  },
};
