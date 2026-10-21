import type { MemoTag } from '@/types/memo';

const MAX_TAG_LENGTH = 20;
const MAX_AI_TAGS = 5;
const MAX_SUMMARY_LENGTH = 140;

export function normalizeTag(raw: string): string | null {
  const tag = raw.trim().replace(/^#/, '').replace(/\s+/g, ' ');
  if (!tag) {
    return null;
  }
  return tag.slice(0, MAX_TAG_LENGTH);
}

const GENERIC_TAGS = new Set([
  '메모',
  '노트',
  '생각',
  '기록',
  '기타',
  '일반',
  '일상',
  '오늘',
  '내일',
  '내용',
  'memo',
  'note',
  'notes',
  'thought',
  'thoughts',
]);

export function tagKey(name: string): string {
  return name.trim().replace(/^#/, '').replace(/\s+/g, ' ').toLowerCase();
}

export function tagsForDraft(current: readonly MemoTag[], userTags: readonly string[]): MemoTag[] {
  const userKeys = new Set(userTags.map((tag) => tagKey(tag)));
  const user = userTags.map((name) => ({ name, source: 'USER' as const }));
  const ai = current.filter((tag) => tag.source === 'AI' && !userKeys.has(tagKey(tag.name)));
  return [...user, ...ai];
}

export function mergeAnalysisTags(current: readonly MemoTag[], aiTags: readonly string[]): MemoTag[] {
  const user = current.filter((tag) => tag.source === 'USER');
  const used = new Set(user.map((tag) => tagKey(tag.name)));
  const ai: MemoTag[] = [];

  for (const raw of aiTags) {
    if (ai.length >= MAX_AI_TAGS) {
      break;
    }
    const name = normalizeTag(raw);
    if (!name) {
      continue;
    }
    const key = tagKey(name);
    if (used.has(key) || GENERIC_TAGS.has(key) || /^[0-9]+$/.test(key)) {
      continue;
    }
    used.add(key);
    ai.push({ name, source: 'AI' });
  }

  return [...user, ...ai];
}

export function cleanSummary(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const summary = value.replace(/\s+/g, ' ').trim();
  if (!summary) {
    return null;
  }
  return summary.length > MAX_SUMMARY_LENGTH ? `${summary.slice(0, MAX_SUMMARY_LENGTH - 1)}…` : summary;
}
