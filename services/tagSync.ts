import { tagKey } from '@/services/tagPolicy';
import type { MemoTag } from '@/types/memo';

export type StoredNoteTag = {
  tagId: string;
  name: string;
  source: 'user' | 'ai';
};

export type TagChange =
  | { type: 'upsert'; name: string; source: 'user' | 'ai' }
  | { type: 'remove'; tagId: string };

const MAX_DB_TAG_LENGTH = 60;

export function planTagChanges(current: readonly StoredNoteTag[], desired: readonly MemoTag[]): TagChange[] {
  const desiredByKey = new Map<string, { name: string; source: 'user' | 'ai' }>();

  for (const tag of desired) {
    const key = tagKey(tag.name);
    if (!key) {
      continue;
    }
    const source = tag.source === 'AI' ? 'ai' : 'user';
    const name = tag.name.trim().replace(/^#/, '').replace(/\s+/g, ' ').slice(0, MAX_DB_TAG_LENGTH);
    const existing = desiredByKey.get(key);
    if (!existing || source === 'user') {
      desiredByKey.set(key, { name, source });
    }
  }

  const changes: TagChange[] = [];
  const seen = new Set<string>();

  for (const row of current) {
    const key = tagKey(row.name);
    const next = desiredByKey.get(key);
    seen.add(key);
    if (!next) {
      changes.push({ type: 'remove', tagId: row.tagId });
      continue;
    }
    if (row.source === 'user' && next.source === 'ai') {
      continue;
    }
    if (row.source !== next.source) {
      changes.push({ type: 'upsert', name: next.name, source: next.source });
    }
  }

  for (const [key, next] of desiredByKey) {
    if (!seen.has(key)) {
      changes.push({ type: 'upsert', name: next.name, source: next.source });
    }
  }

  return changes;
}
