import {
  MAX_ANALYSIS_CHARS,
  MAX_DRAFT_CONTEXT_CHARS,
  MAX_DRAFT_PROMPT_CHARS,
  MAX_MERGE_CHARS,
  MAX_MERGE_MEMOS,
  MAX_ORGANIZE_CHARS,
} from '@/services/aiLimits';
import type { OrganizeMode } from '@/types/ai';
import type { Memo } from '@/types/memo';
import { tagNames } from '@/types/memo';

export type PayloadResult<T> = { ok: true; body: T } | { ok: false; message: string };

export function buildOrganizePayload(content: string, mode: OrganizeMode): PayloadResult<{ content: string; mode: OrganizeMode }> {
  const trimmed = content.trim();
  if (!trimmed) {
    return { ok: false, message: '정리할 내용이 없어요.' };
  }
  if (trimmed.length > MAX_ORGANIZE_CHARS) {
    return { ok: false, message: '내용이 길어서 한 번에 정리하기 어려워요. 메모를 나눠 주세요.' };
  }
  return { ok: true, body: { content: trimmed, mode } };
}

export function buildAnalyzePayload(title: string, content: string): PayloadResult<{ content: string }> {
  const combined = `${title.trim()}\n${content.trim()}`.trim();
  if (combined.length > MAX_ANALYSIS_CHARS) {
    return { ok: false, message: '내용이 길어서 요약을 만들지 못해요.' };
  }
  return { ok: true, body: { content: combined } };
}

export function buildRelatedPayload(
  memo: Pick<Memo, 'id' | 'title' | 'aiSummary' | 'tags'>,
  candidates: readonly Pick<Memo, 'id' | 'title' | 'aiSummary' | 'tags'>[],
): {
  memo: { id: string; title: string; summary: string; tags: string[] };
  candidates: { id: string; title: string; summary: string; tags: string[] }[];
} {
  return {
    memo: toCandidate(memo),
    candidates: candidates.map(toCandidate),
  };
}

export function buildMergePayload(
  memos: readonly Pick<Memo, 'id' | 'title' | 'contentMarkdown'>[],
): PayloadResult<{ memos: { id: string; title: string; contentMarkdown: string }[] }> {
  if (memos.length < 2) {
    return { ok: false, message: '메모를 2개 이상 선택해 주세요.' };
  }
  if (memos.length > MAX_MERGE_MEMOS) {
    return { ok: false, message: `한 번에 ${MAX_MERGE_MEMOS}개까지 모을 수 있어요.` };
  }
  const total = memos.reduce((sum, memo) => sum + memo.title.length + memo.contentMarkdown.length, 0);
  if (total > MAX_MERGE_CHARS) {
    return { ok: false, message: '선택한 내용이 너무 길어요. 메모 수를 줄여 주세요.' };
  }
  return {
    ok: true,
    body: {
      memos: memos.map((memo) => ({
        id: memo.id,
        title: memo.title,
        contentMarkdown: memo.contentMarkdown,
      })),
    },
  };
}

export function buildDraftPayload(
  prompt: string,
  context?: string,
): PayloadResult<{ prompt: string; context?: string }> {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return { ok: false, message: '단어나 요청을 먼저 적어 주세요.' };
  }
  if (trimmed.length > MAX_DRAFT_PROMPT_CHARS) {
    return { ok: false, message: '요청이 너무 길어요. 조금 줄여 주세요.' };
  }
  const reference = context?.trim() ?? '';
  if (!reference) {
    return { ok: true, body: { prompt: trimmed } };
  }
  const clipped =
    reference.length > MAX_DRAFT_CONTEXT_CHARS
      ? `${reference.slice(0, MAX_DRAFT_CONTEXT_CHARS - 20).trim()}\n\n(이하 생략)`
      : reference;
  return { ok: true, body: { prompt: trimmed, context: clipped } };
}

function toCandidate(memo: Pick<Memo, 'id' | 'title' | 'aiSummary' | 'tags'>) {
  return {
    id: memo.id,
    title: memo.title.trim() || '제목 없음',
    summary: memo.aiSummary?.trim() ?? '',
    tags: tagNames(memo.tags).slice(0, 8),
  };
}
