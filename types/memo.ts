export type TagSource = 'USER' | 'AI';

export type AiAnalysisStatus = 'idle' | 'pending' | 'done' | 'failed' | 'skipped';

export type MemoTag = {
  name: string;
  source: TagSource;
};

export type Memo = {
  id: string;
  title: string;
  contentMarkdown: string;
  aiSummary: string | null;
  tags: MemoTag[];
  isFavorite: boolean;
  isPinned: boolean;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastViewedAt: string | null;
  analyzedContentHash: string | null;
  aiAnalysisStatus: AiAnalysisStatus;
  aiDraft?: string | null;
  aiDraftStatus?: 'none' | 'draft' | 'applied';
  isArchived?: boolean;
};

export type MemoDraft = {
  title: string;
  contentMarkdown: string;
  userTags: string[];
};

export type Attachment = {
  id: string;
  memoId: string;
  localUri: string;
  mimeType: string;
  createdAt: string;
  storagePath?: string | null;
  fileName?: string | null;
  signedUrlExpiresAt?: string | null;
};

export type RelationType = 'LINK';

export type LinkStatus = 'suggested' | 'accepted' | 'rejected';

export type LinkSource = 'ai' | 'user';

export type MemoRelation = {
  id: string;
  sourceMemoId: string;
  targetMemoId: string;
  relationType: RelationType;
  createdAt: string;
  status?: LinkStatus;
  source?: LinkSource;
  reason?: string | null;
};

export type MemoSource = {
  mergedMemoId: string;
  sourceMemoId: string;
  position: number;
};

export type MemoGraph = {
  memos: Memo[];
  attachments: Attachment[];
  relations: MemoRelation[];
  sources: MemoSource[];
};

export type MemoSort = 'newest' | 'oldest';

export type MemoCollectionFilter = 'all' | 'favorites' | 'pinned';

export type SaveDraftResult = 'saved' | 'unchanged' | 'skipped' | 'failed';

export function tagNames(tags: readonly Pick<MemoTag, 'name'>[]): string[] {
  return tags.map((tag) => tag.name);
}

export function userTagNames(tags: readonly MemoTag[]): string[] {
  return tags.filter((tag) => tag.source === 'USER').map((tag) => tag.name);
}
