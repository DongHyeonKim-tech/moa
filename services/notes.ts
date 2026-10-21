import { supabase } from '@/lib/supabase';
import { AppDataError, throwDataError } from '@/services/dataError';
import { assertUuid } from '@/services/noteMapper';
import type { NoteRow } from '@/types/database';
import type { Memo } from '@/types/memo';

function clampLimit(value: number, max: number): number {
  return Math.min(max, Math.max(1, Math.floor(value)));
}

export async function listNotes(): Promise<NoteRow[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false });
  if (error) {
    throwDataError(error, '메모를 불러오지 못했어요. 다시 시도해 주세요.');
  }
  return data ?? [];
}

export async function searchNotes(query: string, limit = 30): Promise<NoteRow[]> {
  const { data, error } = await supabase.rpc('moa_search_notes', {
    p_query: query,
    p_limit: clampLimit(limit, 100),
  });
  if (error) {
    throwDataError(error, '메모를 검색하지 못했어요. 다시 시도해 주세요.');
  }
  return data ?? [];
}

export async function fetchNote(noteId: string): Promise<NoteRow> {
  const { data, error } = await supabase.from('notes').select('*').eq('id', assertUuid(noteId)).maybeSingle();
  if (error) {
    throwDataError(error, '메모를 다시 불러오지 못했어요. 다시 시도해 주세요.');
  }
  if (!data) {
    throw new AppDataError('메모를 찾지 못했어요.');
  }
  return data;
}

export async function ensureNote(noteId: string): Promise<void> {
  const id = assertUuid(noteId);
  const { data, error } = await supabase.from('notes').select('id').eq('id', id).maybeSingle();
  if (error) {
    throwDataError(error, '메모를 확인하지 못했어요. 다시 시도해 주세요.');
  }
  if (data) {
    return;
  }

  const inserted = await supabase.from('notes').insert({ id, title: '', content: '' }).select('id').single();
  if (inserted.error) {
    throwDataError(inserted.error, '메모를 만들지 못했어요. 다시 시도해 주세요.');
  }
}

export async function saveNote(memo: Memo): Promise<void> {
  const { error } = await supabase.from('notes').upsert(
    {
      id: assertUuid(memo.id),
      title: memo.title.slice(0, 300),
      content: memo.contentMarkdown,
      is_pinned: memo.isPinned,
      deleted_at: memo.isDeleted ? (memo.deletedAt ?? new Date().toISOString()) : null,
    },
    { onConflict: 'id' },
  );
  if (error) {
    throwDataError(error, '메모를 저장하지 못했어요. 다시 시도해 주세요.');
  }
}

export async function saveAiDraft(noteId: string, markdown: string): Promise<void> {
  const { error } = await supabase
    .from('notes')
    .update({ ai_content: markdown, ai_status: 'draft' })
    .eq('id', assertUuid(noteId))
    .is('deleted_at', null);
  if (error) {
    throwDataError(error, '정리 초안을 저장하지 못했어요. 다시 시도해 주세요.');
  }
}

export async function applyAiDraft(noteId: string): Promise<NoteRow> {
  const id = assertUuid(noteId);
  const { data, error } = await supabase.rpc('moa_apply_ai_draft', { p_note_id: id });
  if (error) {
    throwDataError(error, '정리 결과를 적용하지 못했어요. 다시 시도해 주세요.');
  }
  if (!data) {
    throw new AppDataError('적용할 정리 초안이 없어요. 다시 정리한 뒤 적용해 주세요.');
  }
  return fetchNote(id);
}

export async function updateNoteTitle(noteId: string, title: string): Promise<void> {
  const { error } = await supabase.from('notes').update({ title: title.slice(0, 300) }).eq('id', assertUuid(noteId));
  if (error) {
    throwDataError(error, '제목을 저장하지 못했어요. 다시 시도해 주세요.');
  }
}

export async function deleteNote(noteId: string): Promise<void> {
  const { error } = await supabase.from('notes').delete().eq('id', assertUuid(noteId));
  if (error) {
    throwDataError(error, '메모를 완전히 지우지 못했어요. 다시 시도해 주세요.');
  }
}
