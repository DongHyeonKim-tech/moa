import type { Memo, MemoDraft } from '@/types/memo';

const MAX_TAG_LENGTH = 20;
const MAX_TAGS = 12;

export function isBlankDraft(draft: MemoDraft): boolean {
  return draft.title.trim().length === 0 && draft.content.trim().length === 0 && draft.tags.length === 0;
}

export function draftFromMemo(memo: Memo | null | undefined): MemoDraft {
  if (!memo) {
    return { title: '', content: '', tags: [] };
  }

  return {
    title: memo.title,
    content: memo.content,
    tags: memo.tags,
  };
}

export function normalizeTag(raw: string): string | null {
  const tag = raw.trim().replace(/^#/, '').replace(/\s+/g, ' ');
  if (!tag) {
    return null;
  }

  return tag.slice(0, MAX_TAG_LENGTH);
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
  return memo.title !== draft.title || memo.content !== draft.content || !tagsEqual(memo.tags, draft.tags);
}
