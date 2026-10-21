import type { AiAnalysisStatus, Memo, MemoTag, TagSource } from '@/types/memo';

const STATUSES: readonly AiAnalysisStatus[] = ['idle', 'pending', 'done', 'failed', 'skipped'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStatus(value: string): value is AiAnalysisStatus {
  return (STATUSES as readonly string[]).includes(value);
}

export function parseAnalysisStatus(value: unknown): AiAnalysisStatus {
  return typeof value === 'string' && isStatus(value) ? value : 'idle';
}

export function legacyMemoFromUnknown(value: unknown): Memo | null {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.id !== 'string' || typeof value.title !== 'string' || typeof value.createdAt !== 'string') {
    return null;
  }

  const contentMarkdown =
    typeof value.contentMarkdown === 'string'
      ? value.contentMarkdown
      : typeof value.content === 'string'
        ? value.content
        : null;
  if (contentMarkdown === null || typeof value.updatedAt !== 'string') {
    return null;
  }

  return {
    id: value.id,
    title: value.title,
    contentMarkdown,
    aiSummary: typeof value.aiSummary === 'string' ? value.aiSummary : null,
    tags: parseTags(value.tags),
    isFavorite: value.isFavorite === true,
    isPinned: value.isPinned === true,
    isDeleted: value.isDeleted === true,
    deletedAt: typeof value.deletedAt === 'string' ? value.deletedAt : null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    lastViewedAt: typeof value.lastViewedAt === 'string' ? value.lastViewedAt : null,
    analyzedContentHash: typeof value.analyzedContentHash === 'string' ? value.analyzedContentHash : null,
    aiAnalysisStatus: parseAnalysisStatus(value.aiAnalysisStatus),
  };
}

export function legacyMemoList(value: unknown): Memo[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    const memo = legacyMemoFromUnknown(item);
    return memo ? [memo] : [];
  });
}

function parseTags(value: unknown): MemoTag[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const tags: MemoTag[] = [];
  for (const item of value) {
    if (typeof item === 'string' && item.trim()) {
      tags.push({ name: item, source: 'USER' });
      continue;
    }
    if (!isRecord(item) || typeof item.name !== 'string' || !item.name.trim()) {
      continue;
    }
    const source: TagSource = item.source === 'AI' ? 'AI' : 'USER';
    tags.push({ name: item.name, source });
  }
  return tags;
}
