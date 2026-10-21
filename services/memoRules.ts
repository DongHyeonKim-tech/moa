import { normalizeTag, tagsForDraft } from '@/services/tagPolicy';
import type { Memo, MemoDraft } from '@/types/memo';
import { userTagNames } from '@/types/memo';

const MAX_TAGS = 12;

export function isBlankDraft(draft: MemoDraft): boolean {
  return draft.title.trim().length === 0 && draft.contentMarkdown.trim().length === 0 && draft.userTags.length === 0;
}

export function draftFromMemo(memo: Memo | null | undefined): MemoDraft {
  if (!memo) {
    return { title: '', contentMarkdown: '', userTags: [] };
  }

  return {
    title: memo.title,
    contentMarkdown: memo.contentMarkdown,
    userTags: userTagNames(memo.tags),
  };
}

export function addTag(tags: readonly string[], raw: string): string[] {
  if (tags.length >= MAX_TAGS) {
    return [...tags];
  }

  const tag = normalizeTag(raw);
  if (!tag) {
    return [...tags];
  }

  if (tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
    return [...tags];
  }

  return [...tags, tag];
}

export function addTagsFromInput(tags: readonly string[], raw: string): string[] {
  return raw.split(/[,，]/).reduce<string[]>((next, part) => addTag(next, part), [...tags]);
}

export function removeTag(tags: readonly string[], tag: string): string[] {
  return tags.filter((existing) => existing !== tag);
}

export function tagsEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((tag, index) => tag === right[index]);
}

export function contentChanged(memo: Memo, draft: MemoDraft): boolean {
  return (
    memo.title !== draft.title ||
    memo.contentMarkdown !== draft.contentMarkdown ||
    !tagsEqual(userTagNames(memo.tags), draft.userTags)
  );
}

export function nextMemoFromDraft(current: Memo | null, id: string, draft: MemoDraft, now: string): Memo | null {
  if (!current && isBlankDraft(draft)) {
    return null;
  }
  if (current && !contentChanged(current, draft)) {
    return current;
  }

  const tags = tagsForDraft(current?.tags ?? [], draft.userTags);
  if (current) {
    return {
      ...current,
      title: draft.title,
      contentMarkdown: draft.contentMarkdown,
      tags,
      updatedAt: now,
    };
  }

  return {
    id,
    title: draft.title,
    contentMarkdown: draft.contentMarkdown,
    aiSummary: null,
    tags,
    isFavorite: false,
    isPinned: false,
    isDeleted: false,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    lastViewedAt: now,
    analyzedContentHash: null,
    aiAnalysisStatus: 'idle',
  };
}
