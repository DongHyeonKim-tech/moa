import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Memo } from '@/types/memo';

const MEMO_STORAGE_KEY = 'moa.memos.v1';

export type MemoRepository = {
  loadAll: () => Promise<Memo[]>;
  saveAll: (memos: readonly Memo[]) => Promise<void>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function parseMemo(value: unknown): Memo | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.content !== 'string' ||
    !isStringArray(value.tags) ||
    typeof value.isFavorite !== 'boolean' ||
    typeof value.isPinned !== 'boolean' ||
    typeof value.isDeleted !== 'boolean' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null;
  }

  const deletedAt = typeof value.deletedAt === 'string' ? value.deletedAt : null;
  const lastViewedAt = typeof value.lastViewedAt === 'string' ? value.lastViewedAt : null;

  return {
    id: value.id,
    title: value.title,
    content: value.content,
    tags: value.tags,
    isFavorite: value.isFavorite,
    isPinned: value.isPinned,
    isDeleted: value.isDeleted,
    deletedAt,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    lastViewedAt,
  };
}

export const localMemoRepository: MemoRepository = {
  async loadAll() {
    const raw = await AsyncStorage.getItem(MEMO_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.flatMap((item) => {
        const memo = parseMemo(item);
        return memo ? [memo] : [];
      });
    } catch {
      return [];
    }
  },

  async saveAll(memos) {
    await AsyncStorage.setItem(MEMO_STORAGE_KEY, JSON.stringify(memos));
  },
};
