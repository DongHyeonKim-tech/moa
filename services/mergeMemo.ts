import type { Memo, MemoSource } from '@/types/memo';

export function buildMergedMemo(input: {
  id: string;
  title: string;
  contentMarkdown: string;
  sourceIds: readonly string[];
  now: string;
}): { memo: Memo; sources: MemoSource[] } {
  const sourceIds = [...new Set(input.sourceIds.filter((id) => id && id !== input.id))];
  return {
    memo: {
      id: input.id,
      title: input.title,
      contentMarkdown: input.contentMarkdown,
      aiSummary: null,
      tags: [],
      isFavorite: false,
      isPinned: false,
      isDeleted: false,
      deletedAt: null,
      createdAt: input.now,
      updatedAt: input.now,
      lastViewedAt: input.now,
      analyzedContentHash: null,
      aiAnalysisStatus: 'idle',
    },
    sources: sourceIds.map((sourceMemoId, position) => ({
      mergedMemoId: input.id,
      sourceMemoId,
      position,
    })),
  };
}
