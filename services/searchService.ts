import type { Memo } from '@/types/memo';
import type { MemoSearchProvider, SearchHit, SearchQuery } from '@/types/search';

function normalizeTerm(term: string): string {
  return term.trim().toLowerCase().replace(/^#/, '');
}

export function searchText(memos: readonly Memo[], query: SearchQuery): SearchHit[] {
  const terms = query.text
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(normalizeTerm)
    .filter((term) => term.length > 0);

  if (terms.length === 0) {
    return [];
  }

  return memos
    .filter((memo) => !memo.isDeleted)
    .filter((memo) => {
      const haystack = `${memo.title}\n${memo.contentMarkdown}\n${memo.aiSummary ?? ''}\n${memo.tags.map((tag) => tag.name).join(' ')}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((memo) => ({ memo }));
}

export const textSearchProvider: MemoSearchProvider = {
  id: 'text',
  search: searchText,
};

export function searchMemos(
  memos: readonly Memo[],
  text: string,
  provider: MemoSearchProvider = textSearchProvider,
): SearchHit[] {
  return provider.search(memos, { text });
}
