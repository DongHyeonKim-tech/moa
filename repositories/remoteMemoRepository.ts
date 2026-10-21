import { createSignedUrlMap, listAttachments, removeImages, removeStoredImage, uploadNoteImage } from '@/services/attachments';
import { deleteLinksForNote, listLinks, upsertNoteLink } from '@/services/links';
import { loadNoteMeta, removeNoteMeta, writeNoteMeta } from '@/services/localNoteMeta';
import { applyAiDraft, deleteNote, ensureNote, fetchNote, listNotes, saveAiDraft, saveNote, searchNotes, updateNoteTitle } from '@/services/notes';
import { fromDbTagSource, memoFromNote, relationFromLink, attachmentFromRow } from '@/services/noteMapper';
import { deleteNoteTags, listNoteTags, listTags, syncNoteTags } from '@/services/tags';
import type { NoteAttachmentRow, NoteRow } from '@/types/database';
import type { Attachment, Memo, MemoGraph, MemoRelation, MemoSource, MemoTag } from '@/types/memo';

const SIGNED_URL_REFRESH_MS = 5 * 60 * 1000;

async function attachmentsWithUrls(rows: readonly NoteAttachmentRow[]): Promise<Attachment[]> {
  const signed = await createSignedUrlMap(rows.map((row) => row.storage_path));
  return rows.map((row) => {
    const url = signed.get(row.storage_path);
    return {
      ...attachmentFromRow(row, url?.url ?? ''),
      signedUrlExpiresAt: url?.expiresAt ?? null,
    };
  });
}

function tagsForNotes(
  noteTags: readonly { note_id: string; tag_id: string; source: string }[],
  tagNames: ReadonlyMap<string, string>,
): Map<string, MemoTag[]> {
  const grouped = new Map<string, MemoTag[]>();
  for (const row of noteTags) {
    const name = tagNames.get(row.tag_id);
    if (!name) {
      continue;
    }
    const list = grouped.get(row.note_id) ?? [];
    list.push({ name, source: fromDbTagSource(row.source) });
    grouped.set(row.note_id, list);
  }
  return grouped;
}

function memoFromRow(note: NoteRow, tags: readonly MemoTag[], meta: Awaited<ReturnType<typeof loadNoteMeta>>): Memo {
  return memoFromNote(note, tags, meta[note.id]);
}

async function eraseNote(id: string): Promise<void> {
  const rows = (await listAttachments()).filter((row) => row.note_id === id);
  await removeImages(rows);
  await deleteNoteTags(id);
  await deleteLinksForNote(id);
  await deleteNote(id);
  await removeNoteMeta(id);
}

export const remoteMemoRepository = {
  async loadGraph(): Promise<MemoGraph> {
    const [notes, tags, noteTags, links, attachmentRows, meta] = await Promise.all([
      listNotes(),
      listTags(),
      listNoteTags(),
      listLinks(),
      listAttachments(),
      loadNoteMeta(),
    ]);
    const tagNames = new Map(tags.map((tag) => [tag.id, tag.name]));
    const tagsByNote = tagsForNotes(noteTags, tagNames);

    return {
      memos: notes.map((note) => memoFromRow(note, tagsByNote.get(note.id) ?? [], meta)),
      relations: links.map(relationFromLink),
      sources: [],
      attachments: await attachmentsWithUrls(attachmentRows),
    };
  },

  async ensureNote(id: string): Promise<Memo> {
    await ensureNote(id);
    const [note, meta] = await Promise.all([fetchNote(id), loadNoteMeta()]);
    return memoFromNote(note, [], meta[id]);
  },

  async saveMemo(memo: Memo): Promise<void> {
    await saveNote(memo);
    await syncNoteTags(memo.id, memo.tags);
    await writeNoteMeta(memo);
  },

  async saveLocalMeta(memo: Memo): Promise<void> {
    await writeNoteMeta(memo);
  },

  async deleteMemo(id: string): Promise<void> {
    await eraseNote(id);
  },

  async deleteTrashed(ids: readonly string[]): Promise<void> {
    for (const id of ids) {
      await eraseNote(id);
    }
  },

  async saveRelation(relation: MemoRelation): Promise<MemoRelation> {
    const id = await upsertNoteLink({
      leftId: relation.sourceMemoId,
      rightId: relation.targetMemoId,
      status: 'accepted',
      source: 'user',
      reason: relation.reason ?? null,
    });
    return { ...relation, id, status: 'accepted', source: 'user' };
  },

  async rejectRelation(relation: MemoRelation): Promise<MemoRelation> {
    const id = await upsertNoteLink({
      leftId: relation.sourceMemoId,
      rightId: relation.targetMemoId,
      status: 'rejected',
      source: 'user',
      reason: relation.reason ?? null,
    });
    return { ...relation, id, status: 'rejected', source: 'user' };
  },

  async createMerged(memo: Memo, _sources: readonly MemoSource[]): Promise<void> {
    await saveNote(memo);
    await syncNoteTags(memo.id, memo.tags);
    await writeNoteMeta(memo);
  },

  async saveAttachment(attachment: Attachment): Promise<Attachment> {
    if (attachment.storagePath) {
      return attachment;
    }
    return uploadNoteImage({
      noteId: attachment.memoId,
      attachmentId: attachment.id,
      localUri: attachment.localUri,
      mimeType: attachment.mimeType,
      fileName: attachment.fileName ?? null,
    });
  },

  async deleteAttachment(attachment: Attachment): Promise<void> {
    await removeStoredImage(attachment);
  },

  async search(query: string): Promise<NoteRow[]> {
    return searchNotes(query, 30);
  },

  async saveAiDraft(noteId: string, markdown: string): Promise<void> {
    await saveAiDraft(noteId, markdown);
  },

  async applyAiDraft(noteId: string, title: string): Promise<Memo> {
    const applied = await applyAiDraft(noteId);
    if (title.trim() && title !== applied.title) {
      await updateNoteTitle(noteId, title);
    }
    const [note, noteTags, tags, meta] = await Promise.all([fetchNote(noteId), listNoteTags(), listTags(), loadNoteMeta()]);
    const tagNames = new Map(tags.map((tag) => [tag.id, tag.name]));
    const memoTags = tagsForNotes(noteTags, tagNames).get(noteId) ?? [];
    return memoFromNote(title.trim() && title !== applied.title ? { ...note, title: title.slice(0, 300) } : note, memoTags, meta[noteId]);
  },

  async refreshAttachmentUrls(attachments: readonly Attachment[]): Promise<Attachment[]> {
    const due = attachments.filter((attachment) => {
      if (!attachment.storagePath) {
        return false;
      }
      if (!attachment.signedUrlExpiresAt) {
        return true;
      }
      return new Date(attachment.signedUrlExpiresAt).getTime() - Date.now() < SIGNED_URL_REFRESH_MS;
    });
    if (due.length === 0) {
      return [...attachments];
    }
    const signed = await createSignedUrlMap(due.map((attachment) => attachment.storagePath ?? ''));
    return attachments.map((attachment) => {
      const path = attachment.storagePath;
      if (!path) {
        return attachment;
      }
      const url = signed.get(path);
      if (!url) {
        return attachment;
      }
      return { ...attachment, localUri: url.url, signedUrlExpiresAt: url.expiresAt };
    });
  },
};
