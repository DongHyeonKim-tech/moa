import { supabase } from '@/lib/supabase';
import { AppDataError, throwDataError } from '@/services/dataError';
import { assertUuid } from '@/services/noteMapper';
import type { NoteLinkRow, RelatedNoteRow } from '@/types/database';
import type { LinkSource, LinkStatus } from '@/types/memo';

function clampLimit(value: number, max: number): number {
  return Math.min(max, Math.max(1, Math.floor(value)));
}

export async function listLinks(): Promise<NoteLinkRow[]> {
  const { data, error } = await supabase.from('note_links').select('*');
  if (error) {
    throwDataError(error, '연결된 메모를 불러오지 못했어요. 다시 시도해 주세요.');
  }
  return data ?? [];
}

export async function relatedNotes(noteId: string, limit = 10): Promise<RelatedNoteRow[]> {
  const { data, error } = await supabase.rpc('moa_related_notes', {
    p_note_id: assertUuid(noteId),
    p_limit: clampLimit(limit, 50),
  });
  if (error) {
    throwDataError(error, '비슷한 메모를 찾지 못했어요. 다시 시도해 주세요.');
  }
  return data ?? [];
}

export async function upsertNoteLink(input: {
  leftId: string;
  rightId: string;
  status: LinkStatus;
  source: LinkSource;
  reason?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc('moa_upsert_note_link', {
    p_note_1: assertUuid(input.leftId),
    p_note_2: assertUuid(input.rightId),
    p_status: input.status,
    p_source: input.source,
    p_reason: input.reason ?? null,
  });
  if (error) {
    throwDataError(error, '메모 연결을 저장하지 못했어요. 다시 시도해 주세요.');
  }
  if (!data) {
    throw new AppDataError('메모 연결을 저장하지 못했어요. 다시 시도해 주세요.');
  }
  return data;
}

export async function deleteLinksForNote(noteId: string): Promise<void> {
  const id = assertUuid(noteId);
  const { error } = await supabase.from('note_links').delete().or(`note_a.eq.${id},note_b.eq.${id}`);
  if (error) {
    throwDataError(error, '메모 연결을 지우지 못했어요. 다시 시도해 주세요.');
  }
}
