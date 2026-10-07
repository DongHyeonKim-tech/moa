import type { Memo, MemoCollectionFilter, MemoSort } from '@/types/memo';
import { searchMemos } from '@/services/searchService';

export function activeMemos(memos: readonly Memo[]): Memo[] {
  return memos.filter((memo) => !memo.isDeleted);
}

export function deletedMemos(memos: readonly Memo[]): Memo[] {
  return memos
    .filter((memo) => memo.isDeleted)
    .sort((left, right) => (right.deletedAt ?? '').localeCompare(left.deletedAt ?? ''));
}

export function collectTags(memos: readonly Memo[]): string[] {
  const tags = new Map<string, string>();

  for (const memo of activeMemos(memos)) {
    for (const tag of memo.tags) {
      const key = tag.toLowerCase();
      if (!tags.has(key)) {
        tags.set(key, tag);
      }
    }
  }

  return [...tags.values()].sort((left, right) => left.localeCompare(right, 'ko'));
}

export function pinnedMemos(memos: readonly Memo[]): Memo[] {
  return activeMemos(memos)
    .filter((memo) => memo.isPinned)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function recentMemos(memos: readonly Memo[], limit = 6): Memo[] {
  return activeMemos(memos)
    .filter((memo) => !memo.isPinned)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, limit);
}

export function hasMoreRecentMemos(memos: readonly Memo[], limit = 6): boolean {
  return activeMemos(memos).filter((memo) => !memo.isPinned).length > limit;
}

type ListOptions = {
  filter: MemoCollectionFilter;
  tag: string | null;
  query: string;
  sort: MemoSort;
};

export function listMemos(memos: readonly Memo[], options: ListOptions): Memo[] {
  let list = activeMemos(memos);

  if (options.filter === 'favorites') {
    list = list.filter((memo) => memo.isFavorite);
  }
  if (options.filter === 'pinned') {
    list = list.filter((memo) => memo.isPinned);
  }
  if (options.tag) {
    const tag = options.tag.toLowerCase();
    list = list.filter((memo) => memo.tags.some((item) => item.toLowerCase() === tag));
  }
  if (options.query.trim()) {
    const matched = new Set(searchMemos(list, options.query).map((hit) => hit.memo.id));
    list = list.filter((memo) => matched.has(memo.id));
  }

  const direction = options.sort === 'newest' ? -1 : 1;
  return [...list].sort((left, right) => {
    if (left.isPinned !== right.isPinned) {
      return left.isPinned ? -1 : 1;
    }
    return left.updatedAt.localeCompare(right.updatedAt) * direction;
  });
}
