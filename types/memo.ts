export type Memo = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  isFavorite: boolean;
  isPinned: boolean;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastViewedAt: string | null;
};

export type MemoDraft = {
  title: string;
  content: string;
  tags: string[];
};

export type MemoSort = 'newest' | 'oldest';

export type MemoCollectionFilter = 'all' | 'favorites' | 'pinned';

export type SaveDraftResult = 'saved' | 'unchanged' | 'skipped';
