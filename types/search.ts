import type { Memo } from '@/types/memo';

export type SearchQuery = {
  text: string;
};

export type SearchHit = {
  memo: Memo;
  /** Present when a future semantic provider ranks results. */
  score?: number;
};

/**
 * Screens depend on this function shape, not on a specific search algorithm.
 * A later embedding search can replace the text provider without changing the UI.
 */
export type MemoSearchProvider = {
  id: string;
  search: (memos: readonly Memo[], query: SearchQuery) => SearchHit[];
};
