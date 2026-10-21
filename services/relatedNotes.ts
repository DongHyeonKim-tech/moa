import { MAX_RELATED_CANDIDATES } from '@/services/aiLimits';
import { tagKey } from '@/services/tagPolicy';
import type { Memo } from '@/types/memo';
import { closedMemoIds } from '@/services/relationRules';
import type { MemoRelation } from '@/types/memo';

export type MemoCandidate = {
  memo: Memo;
  sharedTags: string[];
  score: number;
};

export type CandidateRetriever = {
  id: string;
  find: (memo: Memo, memos: readonly Memo[]) => MemoCandidate[];
};

const SUMMARY_STOPWORDS = new Set(['그리고', '에서', '으로', '하는', '있는', '위한', '이번', '다음', '관련', '내용']);

export function findTagCandidates(memo: Memo, memos: readonly Memo[]): MemoCandidate[] {
  const ownTags = uniqueTags(memo);
  if (ownTags.size === 0) {
    return [];
  }

  const candidates: MemoCandidate[] = [];
  for (const other of memos) {
    if (other.id === memo.id || other.isDeleted) {
      continue;
    }
    const shared = other.tags.filter((tag) => ownTags.has(tagKey(tag.name)));
    const sharedNames = uniqueNames(shared.map((tag) => tag.name));
    if (sharedNames.length === 0) {
      continue;
    }
    const summaryScore = tokenOverlap(memo.aiSummary, other.aiSummary);
    candidates.push({
      memo: other,
      sharedTags: sharedNames,
      score: sharedNames.length * 2 + summaryScore,
    });
  }

  return candidates
    .sort((left, right) => right.score - left.score || right.memo.updatedAt.localeCompare(left.memo.updatedAt))
    .slice(0, MAX_RELATED_CANDIDATES);
}

export const tagCandidateRetriever: CandidateRetriever = {
  id: 'tag',
  find: findTagCandidates,
};

export function isWorthSuggesting(candidate: MemoCandidate): boolean {
  const summaryScore = candidate.score - candidate.sharedTags.length * 2;
  return candidate.sharedTags.length >= 2 || (candidate.sharedTags.length === 1 && summaryScore >= 1);
}

export function localReason(candidate: MemoCandidate): string {
  if (candidate.sharedTags.length >= 2) {
    return '겹치는 주제가 있어요';
  }
  return '요약이 비슷해요';
}

export type HomeRelated = {
  source: Memo;
  related: Memo;
  reason: string;
};

export function selectHomeRelated(memos: readonly Memo[], relations: readonly MemoRelation[], limit = 3): HomeRelated[] {
  const recent = memos
    .filter((memo) => !memo.isDeleted)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 8);
  const picked: HomeRelated[] = [];
  const seen = new Set<string>();

  for (const memo of recent) {
    const linked = new Set(closedMemoIds(memo.id, relations));
    for (const candidate of findTagCandidates(memo, memos)) {
      if (!isWorthSuggesting(candidate) || linked.has(candidate.memo.id)) {
        continue;
      }
      const key = [memo.id, candidate.memo.id].sort().join(':');
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      picked.push({ source: memo, related: candidate.memo, reason: localReason(candidate) });
      if (picked.length >= limit) {
        return picked;
      }
    }
  }

  return picked;
}

function uniqueTags(memo: Memo): Set<string> {
  return new Set(memo.tags.map((tag) => tagKey(tag.name)));
}

function uniqueNames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    const key = tagKey(name);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(name);
  }
  return result;
}

function tokens(value: string | null): Set<string> {
  if (!value) {
    return new Set();
  }
  return new Set(
    value
      .toLowerCase()
      .split(/[\s,./|()[\]{}'"`~!@#$%^&*_+=:;<>?，。、]+/)
      .filter((token) => token.length >= 2 && !SUMMARY_STOPWORDS.has(token)),
  );
}

function tokenOverlap(left: string | null, right: string | null): number {
  const rightTokens = tokens(right);
  let count = 0;
  for (const token of tokens(left)) {
    if (rightTokens.has(token)) {
      count += 1;
    }
  }
  return count;
}
