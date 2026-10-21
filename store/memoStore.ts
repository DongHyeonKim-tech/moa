import { create } from 'zustand';

import { remoteMemoRepository } from '@/repositories/remoteMemoRepository';
import { referencedAttachmentIds } from '@/services/attachmentRefs';
import { deleteAttachmentFile } from '@/services/attachmentFiles';
import { userFacingError } from '@/services/dataError';
import { buildMergedMemo } from '@/services/mergeMemo';
import { nextMemoFromDraft } from '@/services/memoRules';
import { memoFromNote } from '@/services/noteMapper';
import { findRelation, planLink } from '@/services/relationRules';
import { mergeAnalysisTags } from '@/services/tagPolicy';
import type { AiInsertion, MemoAnalysis, RelatedSuggestion } from '@/types/ai';
import type {
  AiAnalysisStatus,
  Attachment,
  Memo,
  MemoDraft,
  MemoGraph,
  MemoRelation,
  MemoSource,
  SaveDraftResult,
} from '@/types/memo';
import { contentFingerprint } from '@/utils/fingerprint';
import { createId } from '@/utils/id';

type MemoState = MemoGraph & {
  hydrated: boolean;
  syncError: string | null;
  suggestions: Record<string, RelatedSuggestion[]>;
  aiInsertion: AiInsertion | null;
  queueAiInsertion: (insertion: AiInsertion) => void;
  consumeAiInsertion: (memoId: string) => AiInsertion | null;
  hydrate: () => Promise<void>;
  clearSyncError: () => void;
  saveDraft: (id: string, draft: MemoDraft) => Promise<SaveDraftResult>;
  toggleFavorite: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  moveToTrash: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
  deleteForever: (id: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  markViewed: (id: string) => Promise<void>;
  removeAiTag: (id: string, name: string) => Promise<void>;
  addAttachment: (attachment: Attachment) => Promise<Attachment>;
  setAnalysisStatus: (id: string, status: AiAnalysisStatus) => Promise<void>;
  markAnalysisSkipped: (id: string, fingerprint: string) => Promise<void>;
  applyAnalysis: (id: string, fingerprint: string, analysis: MemoAnalysis) => Promise<boolean>;
  linkMemos: (leftId: string, rightId: string) => Promise<boolean>;
  unlinkMemos: (leftId: string, rightId: string) => Promise<void>;
  createMergedMemo: (input: { title: string; contentMarkdown: string; sourceIds: readonly string[] }) => Promise<string>;
  setSuggestions: (memoId: string, suggestions: RelatedSuggestion[]) => void;
  searchNotes: (query: string) => Promise<Memo[]>;
  saveAiDraft: (id: string, markdown: string) => Promise<void>;
  applyAiDraft: (id: string, markdown: string, title: string) => Promise<void>;
  refreshAttachmentUrls: (memoId: string) => Promise<void>;
};

const emptyGraph: MemoGraph = { memos: [], attachments: [], relations: [], sources: [] };

const repository = remoteMemoRepository;
let writeChain: Promise<void> = Promise.resolve();

function persist(task: () => Promise<void>): Promise<void> {
  writeChain = writeChain.catch(() => undefined).then(task);
  return writeChain;
}

function replaceMemo(memos: readonly Memo[], next: Memo): Memo[] {
  const exists = memos.some((memo) => memo.id === next.id);
  if (!exists) {
    return [next, ...memos];
  }
  return memos.map((memo) => (memo.id === next.id ? next : memo));
}

export const useMemoStore = create<MemoState>((set, get) => ({
  ...emptyGraph,
  hydrated: false,
  syncError: null,
  suggestions: {},
  aiInsertion: null,

  queueAiInsertion(insertion) {
    set({ aiInsertion: insertion });
  },

  consumeAiInsertion(memoId) {
    const current = get().aiInsertion;
    if (!current || current.memoId !== memoId) {
      return null;
    }
    set({ aiInsertion: null });
    return current;
  },

  clearSyncError() {
    set({ syncError: null });
  },

  async hydrate() {
    if (get().hydrated) {
      return;
    }

    try {
      const graph = await repository.loadGraph();
      set({ ...graph, hydrated: true, syncError: null });
    } catch (error) {
      if (!get().hydrated) {
        set({ syncError: userFacingError(error) });
      }
      throw error;
    }
  },

  async saveDraft(id, draft) {
    const outcome: { result: SaveDraftResult } = { result: 'unchanged' };
    try {
      await persist(async () => {
        const current = get().memos.find((memo) => memo.id === id) ?? null;
        const next = nextMemoFromDraft(current, id, draft, new Date().toISOString());
        if (!next) {
          outcome.result = 'skipped';
          return;
        }
        if (next === current) {
          outcome.result = 'unchanged';
          return;
        }

        const referenced = new Set(referencedAttachmentIds(next.contentMarkdown));
        const removed = get().attachments.filter((item) => item.memoId === id && !referenced.has(item.id));
        set({
          memos: replaceMemo(get().memos, next),
          attachments: get().attachments.filter((item) => !(item.memoId === id && !referenced.has(item.id))),
        });
        await repository.saveMemo(next);
        for (const attachment of removed) {
          await repository.deleteAttachment(attachment);
          deleteAttachmentFile(attachment.localUri);
        }
        outcome.result = 'saved';
      });
      if (outcome.result === 'saved') {
        set({ syncError: null });
      }
    } catch (error) {
      outcome.result = 'failed';
      set({ syncError: userFacingError(error) });
    }
    return outcome.result;
  },

  async toggleFavorite(id) {
    await updateMemo(set, get, id, (memo) => ({ ...memo, isFavorite: !memo.isFavorite }), { localOnly: true });
  },

  async togglePin(id) {
    await updateMemo(set, get, id, (memo) => ({ ...memo, isPinned: !memo.isPinned }));
  },

  async moveToTrash(id) {
    const now = new Date().toISOString();
    await updateMemo(set, get, id, (memo) => ({ ...memo, isDeleted: true, deletedAt: now }));
    set({
      suggestions: omitKey(get().suggestions, id),
    });
  },

  async restore(id) {
    await updateMemo(set, get, id, (memo) => ({ ...memo, isDeleted: false, deletedAt: null }));
  },

  async deleteForever(id) {
    const uris = get().attachments.filter((item) => item.memoId === id).map((item) => item.localUri);
    try {
      await persist(async () => {
        await repository.deleteMemo(id);
        set({
          memos: get().memos.filter((memo) => memo.id !== id),
          attachments: get().attachments.filter((item) => item.memoId !== id),
          relations: get().relations.filter((item) => item.sourceMemoId !== id && item.targetMemoId !== id),
          sources: get().sources.filter((item) => item.mergedMemoId !== id && item.sourceMemoId !== id),
          suggestions: omitKey(get().suggestions, id),
          syncError: null,
        });
      });
      uris.forEach(deleteAttachmentFile);
    } catch (error) {
      set({ syncError: userFacingError(error) });
    }
  },

  async emptyTrash() {
    const removed = new Set(get().memos.filter((memo) => memo.isDeleted).map((memo) => memo.id));
    const uris = get().attachments.filter((item) => removed.has(item.memoId)).map((item) => item.localUri);
    try {
      await persist(async () => {
        await repository.deleteTrashed([...removed]);
        set({
          memos: get().memos.filter((memo) => !memo.isDeleted),
          attachments: get().attachments.filter((item) => !removed.has(item.memoId)),
          relations: get().relations.filter((item) => !removed.has(item.sourceMemoId) && !removed.has(item.targetMemoId)),
          sources: get().sources.filter((item) => !removed.has(item.mergedMemoId) && !removed.has(item.sourceMemoId)),
          syncError: null,
        });
      });
      uris.forEach(deleteAttachmentFile);
    } catch (error) {
      set({ syncError: userFacingError(error) });
    }
  },

  async markViewed(id) {
    const now = new Date().toISOString();
    await updateMemo(set, get, id, (memo) => (memo.isDeleted ? memo : { ...memo, lastViewedAt: now }), { localOnly: true });
  },

  async removeAiTag(id, name) {
    const key = name.toLowerCase();
    await updateMemo(set, get, id, (memo) => ({
      ...memo,
      tags: memo.tags.filter((tag) => !(tag.source === 'AI' && tag.name.toLowerCase() === key)),
    }));
  },

  async addAttachment(attachment) {
    let stored = attachment;
    await persist(async () => {
      stored = await repository.saveAttachment(attachment);
      set({
        attachments: [...get().attachments.filter((item) => item.id !== stored.id), stored],
        syncError: null,
      });
    });
    return stored;
  },

  async setAnalysisStatus(id, status) {
    await updateMemo(set, get, id, (memo) => ({ ...memo, aiAnalysisStatus: status }), { localOnly: true });
  },

  async markAnalysisSkipped(id, fingerprint) {
    await updateMemo(set, get, id, (memo) =>
      memo.analyzedContentHash === fingerprint
        ? memo
        : { ...memo, analyzedContentHash: fingerprint, aiAnalysisStatus: 'skipped' },
      { localOnly: true },
    );
  },

  async applyAnalysis(id, fingerprint, analysis) {
    let applied = false;
    await persist(async () => {
      const current = get().memos.find((memo) => memo.id === id);
      if (!current || current.isDeleted) {
        return;
      }
      if (contentFingerprint(current.title, current.contentMarkdown) !== fingerprint) {
        return;
      }
      const next: Memo = {
        ...current,
        aiSummary: analysis.summary,
        tags: mergeAnalysisTags(current.tags, analysis.tags),
        analyzedContentHash: fingerprint,
        aiAnalysisStatus: 'done',
      };
      set({ memos: replaceMemo(get().memos, next) });
      await repository.saveMemo(next);
      applied = true;
    });
    return applied;
  },

  async linkMemos(leftId, rightId) {
    let created = false;
    try {
      await persist(async () => {
        const existing = findRelation(get().relations, leftId, rightId);
        if (existing && (existing.status === undefined || existing.status === 'accepted')) {
          return;
        }
        const left = get().memos.find((memo) => memo.id === leftId);
        const right = get().memos.find((memo) => memo.id === rightId);
        if (!left || !right || left.isDeleted || right.isDeleted) {
          return;
        }
        const draft = existing ?? planLink(get().relations, leftId, rightId, createId(), new Date().toISOString());
        if (!draft) {
          return;
        }
        const saved = await repository.saveRelation({ ...draft, status: 'accepted', source: 'user' });
        const relations = existing
          ? get().relations.map((item) => (item.id === existing.id ? saved : item))
          : [...get().relations, saved];
        set({
          relations,
          suggestions: dropSuggestion(dropSuggestion(get().suggestions, leftId, rightId), rightId, leftId),
          syncError: null,
        });
        created = true;
      });
    } catch (error) {
      set({ syncError: userFacingError(error) });
    }
    return created;
  },

  async unlinkMemos(leftId, rightId) {
    try {
      await persist(async () => {
        const relation = findRelation(get().relations, leftId, rightId);
        if (!relation || relation.status === 'rejected') {
          return;
        }
        const saved = await repository.rejectRelation(relation);
        set({
          relations: get().relations.map((item) => (item.id === relation.id ? saved : item)),
          suggestions: dropSuggestion(dropSuggestion(get().suggestions, leftId, rightId), rightId, leftId),
          syncError: null,
        });
      });
    } catch (error) {
      set({ syncError: userFacingError(error) });
    }
  },

  async createMergedMemo(input) {
    const id = createId();
    const { memo, sources } = buildMergedMemo({
      id,
      title: input.title,
      contentMarkdown: input.contentMarkdown,
      sourceIds: input.sourceIds,
      now: new Date().toISOString(),
    });
    try {
      await persist(async () => {
        set({
          memos: [memo, ...get().memos],
          sources: [...get().sources, ...sources],
        });
        await repository.createMerged(memo, sources);
        set({ syncError: null });
      });
    } catch (error) {
      set({ syncError: userFacingError(error) });
      throw error;
    }
    return id;
  },

  setSuggestions(memoId, suggestions) {
    set({ suggestions: { ...get().suggestions, [memoId]: suggestions } });
  },

  async searchNotes(query) {
    const rows = await repository.search(query);
    const meta = new Map(get().memos.map((memo) => [memo.id, memo]));
    return rows.map((row) => meta.get(row.id) ?? memoFromNote(row, []));
  },

  async saveAiDraft(id, markdown) {
    await repository.saveAiDraft(id, markdown);
    set({
      memos: get().memos.map((memo) => (memo.id === id ? { ...memo, aiDraft: markdown, aiDraftStatus: 'draft' } : memo)),
      syncError: null,
    });
  },

  async applyAiDraft(id, markdown, title) {
    await repository.saveAiDraft(id, markdown);
    const next = await repository.applyAiDraft(id, title);
    set({ memos: replaceMemo(get().memos, next), syncError: null });
  },

  async refreshAttachmentUrls(memoId) {
    const current = get().attachments.filter((item) => item.memoId === memoId);
    if (current.length === 0) {
      return;
    }
    const refreshed = await repository.refreshAttachmentUrls(current);
    const byId = new Map(refreshed.map((item) => [item.id, item]));
    set({
      attachments: get().attachments.map((item) => byId.get(item.id) ?? item),
    });
  },
}));

async function updateMemo(
  set: (partial: Partial<MemoState> | ((state: MemoState) => Partial<MemoState>)) => void,
  get: () => MemoState,
  id: string,
  update: (memo: Memo) => Memo,
  options?: { localOnly?: boolean },
): Promise<void> {
  try {
    await persist(async () => {
      const current = get().memos.find((memo) => memo.id === id);
      if (!current) {
        return;
      }
      const next = update(current);
      if (next === current) {
        return;
      }
      set({ memos: get().memos.map((memo) => (memo.id === id ? next : memo)) });
      if (options?.localOnly) {
        await repository.saveLocalMeta(next);
      } else {
        await repository.saveMemo(next);
      }
    });
    set({ syncError: null });
  } catch (error) {
    set({ syncError: userFacingError(error) });
  }
}

function dropSuggestion(
  suggestions: Record<string, RelatedSuggestion[]>,
  memoId: string,
  relatedId: string,
): Record<string, RelatedSuggestion[]> {
  const current = suggestions[memoId];
  if (!current) {
    return suggestions;
  }
  return { ...suggestions, [memoId]: current.filter((item) => item.memoId !== relatedId) };
}

function omitKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

export type { MemoRelation, MemoSource };
