import { File } from 'expo-file-system';

import { supabase } from '@/lib/supabase';
import { AppDataError, throwDataError } from '@/services/dataError';
import { assertAllowedImage, imageStoragePath, MAX_IMAGE_BYTES } from '@/services/imagePath';
import { assertUuid, attachmentFromRow } from '@/services/noteMapper';
import { currentUserId } from '@/services/session';
import { deleteAttachmentFile } from '@/services/attachmentFiles';
import type { NoteAttachmentRow } from '@/types/database';
import type { Attachment } from '@/types/memo';

const BUCKET = 'moa-images';
const SIGNED_URL_SECONDS = 60 * 60;

export async function listAttachments(): Promise<NoteAttachmentRow[]> {
  const { data, error } = await supabase.from('note_attachments').select('*');
  if (error) {
    throwDataError(error, '사진을 불러오지 못했어요. 다시 시도해 주세요.');
  }
  return data ?? [];
}

export async function createSignedUrlMap(paths: readonly string[]): Promise<Map<string, { url: string; expiresAt: string }>> {
  const unique = [...new Set(paths.filter((path) => path.length > 0))];
  const map = new Map<string, { url: string; expiresAt: string }>();
  if (unique.length === 0) {
    return map;
  }

  const expiresAt = new Date(Date.now() + SIGNED_URL_SECONDS * 1000).toISOString();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(unique, SIGNED_URL_SECONDS);
  if (error) {
    throwDataError(error, '사진을 불러오지 못했어요. 다시 시도해 주세요.');
  }
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) {
      map.set(item.path, { url: item.signedUrl, expiresAt });
    }
  }
  return map;
}

export async function uploadNoteImage(input: {
  noteId: string;
  attachmentId: string;
  localUri: string;
  mimeType: string;
  fileName: string | null;
}): Promise<Attachment> {
  const file = new File(input.localUri);
  assertAllowedImage(input.mimeType, file.info().size ?? null);
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new AppDataError('사진은 10MB 이하만 넣을 수 있어요.');
  }

  const userId = await currentUserId();
  const attachmentId = assertUuid(input.attachmentId);
  const path = imageStoragePath(userId, attachmentId, input.mimeType);
  const uploaded = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: input.mimeType,
    upsert: false,
  });
  if (uploaded.error) {
    throwDataError(uploaded.error, '사진을 올리지 못했어요. 다시 시도해 주세요.');
  }

  const inserted = await supabase
    .from('note_attachments')
    .insert({
      id: attachmentId,
      note_id: assertUuid(input.noteId),
      storage_path: path,
      file_name: input.fileName,
      mime_type: input.mimeType,
    })
    .select('*')
    .single();
  if (inserted.error || !inserted.data) {
    await supabase.storage.from(BUCKET).remove([path]);
    throwDataError(inserted.error, '사진 정보를 저장하지 못했어요. 다시 시도해 주세요.');
  }

  const signed = await createSignedUrlMap([path]);
  const url = signed.get(path);
  deleteAttachmentFile(input.localUri);
  return {
    ...attachmentFromRow(inserted.data, url?.url ?? ''),
    signedUrlExpiresAt: url?.expiresAt ?? null,
  };
}

export async function removeStoredImage(attachment: Pick<Attachment, 'id' | 'storagePath'>): Promise<void> {
  if (attachment.storagePath) {
    const removed = await supabase.storage.from(BUCKET).remove([attachment.storagePath]);
    if (removed.error) {
      throwDataError(removed.error, '사진을 지우지 못했어요. 다시 시도해 주세요.');
    }
  }

  const { error } = await supabase.from('note_attachments').delete().eq('id', assertUuid(attachment.id));
  if (error) {
    throwDataError(error, '사진 정보를 지우지 못했어요. 다시 시도해 주세요.');
  }
}

export async function removeImages(rows: readonly NoteAttachmentRow[]): Promise<void> {
  const paths = rows.map((row) => row.storage_path).filter((path) => path.length > 0);
  if (paths.length > 0) {
    const removed = await supabase.storage.from(BUCKET).remove(paths);
    if (removed.error) {
      throwDataError(removed.error, '사진을 지우지 못했어요. 다시 시도해 주세요.');
    }
  }

  const ids = rows.map((row) => row.id);
  if (ids.length === 0) {
    return;
  }
  const { error } = await supabase.from('note_attachments').delete().in('id', ids);
  if (error) {
    throwDataError(error, '사진 정보를 지우지 못했어요. 다시 시도해 주세요.');
  }
}
