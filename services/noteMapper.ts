import { AppDataError } from '@/services/dataError';
import type { NoteAttachmentRow, NoteLinkRow, NoteRow, RelatedNoteRow } from '@/types/database';
import type { AiAnalysisStatus, Attachment, LinkSource, LinkStatus, Memo, MemoRelation, MemoTag, TagSource } from '@/types/memo';

export type LocalNoteMeta = {
  isFavorite: boolean;
  lastViewedAt: string | null;
  analyzedContentHash: string | null;
  aiAnalysisStatus: AiAnalysisStatus;
  aiSummary: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertUuid(value: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new AppDataError('메모 식별자가 올바르지 않아요.');
  }
  return value;
}

export function toDbTagSource(source: TagSource): 'user' | 'ai' {
  return source === 'AI' ? 'ai' : 'user';
}

export function fromDbTagSource(source: string): TagSource {
  return source === 'ai' ? 'AI' : 'USER';
}

export function metaFromMemo(memo: Memo): LocalNoteMeta {
  return {
    isFavorite: memo.isFavorite,
    lastViewedAt: memo.lastViewedAt,
    analyzedContentHash: memo.analyzedContentHash,
    aiAnalysisStatus: memo.aiAnalysisStatus,
    aiSummary: memo.aiSummary,
  };
}

export function memoFromNote(note: NoteRow, tags: readonly MemoTag[], meta?: LocalNoteMeta): Memo {
  return {
    id: note.id,
    title: note.title,
    contentMarkdown: note.content,
    aiSummary: meta?.aiSummary ?? null,
    tags: [...tags],
    isFavorite: meta?.isFavorite ?? false,
    isPinned: note.is_pinned,
    isArchived: note.is_archived,
    isDeleted: note.deleted_at !== null,
    deletedAt: note.deleted_at,
    createdAt: note.created_at,
    updatedAt: note.updated_at,
    lastViewedAt: meta?.lastViewedAt ?? null,
    analyzedContentHash: meta?.analyzedContentHash ?? null,
    aiAnalysisStatus: meta?.aiAnalysisStatus ?? 'idle',
    aiDraft: note.ai_content,
    aiDraftStatus: note.ai_status,
  };
}

export function relationFromLink(link: NoteLinkRow): MemoRelation {
  return {
    id: link.id,
    sourceMemoId: link.note_a,
    targetMemoId: link.note_b,
    relationType: 'LINK',
    createdAt: link.created_at,
    status: link.status,
    source: link.source,
    reason: link.reason,
  };
}

export function attachmentFromRow(row: NoteAttachmentRow, localUri = ''): Attachment {
  return {
    id: row.id,
    memoId: row.note_id,
    localUri,
    storagePath: row.storage_path,
    fileName: row.file_name,
    mimeType: row.mime_type ?? 'image/jpeg',
    createdAt: row.created_at,
  };
}

export function relatedReason(row: Pick<RelatedNoteRow, 'shared_tags'>): string {
  if (row.shared_tags.length === 0) {
    return '태그가 겹쳐요';
  }
  return row.shared_tags
    .slice(0, 3)
    .map((tag) => `#${tag}`)
    .join(' ');
}

export function isClosedLink(status: LinkStatus | undefined): boolean {
  const value = status ?? 'accepted';
  return value === 'accepted' || value === 'rejected';
}

export function isAcceptedLink(status: LinkStatus | undefined): boolean {
  return (status ?? 'accepted') === 'accepted';
}

export function linkSource(source: LinkSource | undefined): LinkSource {
  return source ?? 'user';
}
