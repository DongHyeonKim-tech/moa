import { evaluateRelatedNotes } from '@/services/aiClient';
import { userFacingError } from '@/services/dataError';
import { relatedNotes } from '@/services/links';
import { relatedReason } from '@/services/noteMapper';
import { closedMemoIds } from '@/services/relationRules';
import { findTagCandidates } from '@/services/relatedNotes';
import { useMemoStore } from '@/store/memoStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { RelatedSuggestion } from '@/types/ai';
import { contentFingerprint } from '@/utils/fingerprint';

const cache = new Map<string, string>();

export function suggestionKey(memoId: string): string | null {
  const memo = useMemoStore.getState().memos.find((item) => item.id === memoId);
  if (!memo) {
    return null;
  }
  const tags = memo.tags
    .map((tag) => `${tag.source}:${tag.name.toLowerCase()}`)
    .sort()
    .join(',');
  return contentFingerprint(memo.title, `${memo.contentMarkdown}\n${memo.aiSummary ?? ''}\n${tags}`);
}

export async function refreshRelated(memoId: string, options?: { allowAi?: boolean; force?: boolean }): Promise<void> {
  const state = useMemoStore.getState();
  const memo = state.memos.find((item) => item.id === memoId && !item.isDeleted);
  if (!memo) {
    return;
  }

  const key = suggestionKey(memoId);
  if (!key) {
    return;
  }
  const allowAi = options?.allowAi === true && useSettingsStore.getState().aiConsent;
  const cached = cache.get(memoId);
  if (!options?.force && cached === `ai:${key}`) {
    return;
  }
  if (!options?.force && !allowAi && cached === key) {
    return;
  }

  let rows;
  try {
    rows = await relatedNotes(memoId, 10);
  } catch (error) {
    useMemoStore.setState({ syncError: userFacingError(error) });
    return;
  }

  const blocked = new Set(closedMemoIds(memoId, state.relations));
  const candidates = rows.flatMap((row) => {
    if (blocked.has(row.note_id)) {
      return [];
    }
    const related = state.memos.find((item) => item.id === row.note_id && !item.isDeleted);
    return related ? [{ row, memo: related }] : [];
  });
  const local: RelatedSuggestion[] = candidates.map((candidate) => ({
    memoId: candidate.memo.id,
    reason: relatedReason(candidate.row),
    origin: 'local',
  }));
  state.setSuggestions(memoId, local);

  if (!allowAi || candidates.length === 0) {
    cache.set(memoId, key);
    return;
  }

  try {
    const results = await evaluateRelatedNotes(memo, candidates.map((candidate) => candidate.memo));
    const allowed = new Set(candidates.map((candidate) => candidate.memo.id));
    const ai: RelatedSuggestion[] = [];
    for (const result of results) {
      if (!result.related || result.id === memoId || !allowed.has(result.id) || ai.some((item) => item.memoId === result.id)) {
        continue;
      }
      ai.push({
        memoId: result.id,
        reason: result.reason || '주제가 이어져요',
        origin: 'ai',
      });
    }
    if (ai.length > 0) {
      useMemoStore.getState().setSuggestions(memoId, ai);
    }
    cache.set(memoId, `ai:${key}`);
  } catch {
    cache.set(memoId, key);
  }
}

export { findTagCandidates };
