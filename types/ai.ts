export type OrganizeMode = 'tidy' | 'checklist' | 'prose' | 'summary';

export type MemoAnalysis = {
  tags: string[];
  summary: string | null;
};

export type RelatedSuggestion = {
  memoId: string;
  reason: string;
  origin: 'local' | 'ai';
};

export type DraftedMemo = {
  title: string;
  markdown: string;
};

export type AiInsertion = {
  memoId: string;
  title: string;
  markdown: string;
};

export type AiHealth = {
  reachable: boolean;
  aiConfigured: boolean;
  message: string;
};
