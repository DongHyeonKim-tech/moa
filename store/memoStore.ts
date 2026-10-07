import { create } from 'zustand';

import { localMemoRepository, type MemoRepository } from '@/repositories/memoRepository';
import { contentChanged, isBlankDraft } from '@/services/memoRules';
import type { Memo, MemoDraft, SaveDraftResult } from '@/types/memo';

type MemoState = {
  memos: Memo[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  saveDraft: (id: string, draft: MemoDraft) => Promise<SaveDraftResult>;
  toggleFavorite: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  moveToTrash: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
  deleteForever: (id: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  markViewed: (id: string) => Promise<void>;
};

let repository: MemoRepository = localMemoRepository;
let writeChain: Promise<void> = Promise.resolve();

function persist(memos: readonly Memo[]): Promise<void> {
  const snapshot = memos;
  writeChain = writeChain.catch(() => undefined).then(() => repository.saveAll(snapshot));
  return writeChain;
}

export const useMemoStore = create<MemoState>((set, get) => ({
  memos: [],
  hydrated: false,

  async hydrate() {
    if (get().hydrated) {
      return;
    }

    try {
      const memos = await repository.loadAll();
      set({ memos, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  async saveDraft(id, draft) {
    const current = get().memos.find((memo) => memo.id === id) ?? null;
    if (!current && isBlankDraft(draft)) {
      return 'skipped';
    }

    if (current && !contentChanged(current, draft)) {
      return 'unchanged';
    }

    const now = new Date().toISOString();
    const nextMemo: Memo = current
      ? {
          ...current,
          title: draft.title,
          content: draft.content,
          tags: draft.tags,
          updatedAt: now,
        }
      : {
          id,
          title: draft.title,
          content: draft.content,
          tags: draft.tags,
          isFavorite: false,
          isPinned: false,
          isDeleted: false,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
          lastViewedAt: now,
        };

    const memos = current
      ? get().memos.map((memo) => (memo.id === id ? nextMemo : memo))
      : [nextMemo, ...get().memos];

    set({ memos });
    await persist(memos);
    return 'saved';
  },

  async toggleFavorite(id) {
    await updateMemo(set, get, id, (memo) => ({ ...memo, isFavorite: !memo.isFavorite }));
  },

  async togglePin(id) {
    await updateMemo(set, get, id, (memo) => ({ ...memo, isPinned: !memo.isPinned }));
  },

  async moveToTrash(id) {
    const now = new Date().toISOString();
    await updateMemo(set, get, id, (memo) => ({
      ...memo,
      isDeleted: true,
      deletedAt: now,
    }));
  },

  async restore(id) {
    await updateMemo(set, get, id, (memo) => ({
      ...memo,
      isDeleted: false,
      deletedAt: null,
    }));
  },

  async deleteForever(id) {
    const memos = get().memos.filter((memo) => memo.id !== id);
    set({ memos });
    await persist(memos);
  },

  async emptyTrash() {
    const memos = get().memos.filter((memo) => !memo.isDeleted);
    set({ memos });
    await persist(memos);
  },

  async markViewed(id) {
    const now = new Date().toISOString();
    await updateMemo(set, get, id, (memo) => (memo.isDeleted ? memo : { ...memo, lastViewedAt: now }));
  },
}));

async function updateMemo(
  set: (partial: Partial<MemoState>) => void,
  get: () => MemoState,
  id: string,
  update: (memo: Memo) => Memo,
): Promise<void> {
  const current = get().memos.find((memo) => memo.id === id);
  if (!current) {
    return;
  }

  const next = update(current);
  if (next === current) {
    return;
  }

  const memos = get().memos.map((memo) => (memo.id === id ? next : memo));
  set({ memos });
  await persist(memos);
}
