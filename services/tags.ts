import { supabase } from '@/lib/supabase';
import { throwDataError } from '@/services/dataError';
import { assertUuid } from '@/services/noteMapper';
import { planTagChanges, type StoredNoteTag } from '@/services/tagSync';
import { tagKey } from '@/services/tagPolicy';
import type { NoteTagRow, TagRow } from '@/types/database';
import type { MemoTag } from '@/types/memo';

export async function listTags(): Promise<TagRow[]> {
  const { data, error } = await supabase.from('tags').select('*');
  if (error) {
    throwDataError(error, '태그를 불러오지 못했어요. 다시 시도해 주세요.');
  }
  return data ?? [];
}

export async function listNoteTags(): Promise<NoteTagRow[]> {
  const { data, error } = await supabase.from('note_tags').select('*');
  if (error) {
    throwDataError(error, '태그를 불러오지 못했어요. 다시 시도해 주세요.');
  }
  return data ?? [];
}

export async function deleteNoteTags(noteId: string): Promise<void> {
  const { error } = await supabase.from('note_tags').delete().eq('note_id', assertUuid(noteId));
  if (error) {
    throwDataError(error, '태그를 지우지 못했어요. 다시 시도해 주세요.');
  }
}

export async function syncNoteTags(noteId: string, desired: readonly MemoTag[]): Promise<void> {
  const id = assertUuid(noteId);
  const [links, tags] = await Promise.all([
    supabase.from('note_tags').select('tag_id, source').eq('note_id', id),
    supabase.from('tags').select('id, name'),
  ]);
  if (links.error) {
    throwDataError(links.error, '태그를 저장하지 못했어요. 다시 시도해 주세요.');
  }
  if (tags.error) {
    throwDataError(tags.error, '태그를 저장하지 못했어요. 다시 시도해 주세요.');
  }

  const names = new Map((tags.data ?? []).map((tag) => [tag.id, tag.name]));
  const current: StoredNoteTag[] = (links.data ?? []).flatMap((link) => {
    const name = names.get(link.tag_id);
    if (!name) {
      return [];
    }
    return [{ tagId: link.tag_id, name, source: link.source }];
  });
  const cache = new Map((tags.data ?? []).map((tag) => [tagKey(tag.name), tag]));

  for (const change of planTagChanges(current, desired)) {
    if (change.type === 'remove') {
      const removed = await supabase.from('note_tags').delete().eq('note_id', id).eq('tag_id', change.tagId);
      if (removed.error) {
        throwDataError(removed.error, '태그를 지우지 못했어요. 다시 시도해 주세요.');
      }
      continue;
    }

    const tagId = await findOrCreateTag(change.name, cache);
    const saved = await supabase.from('note_tags').upsert(
      { note_id: id, tag_id: tagId, source: change.source },
      { onConflict: 'note_id,tag_id' },
    );
    if (saved.error) {
      throwDataError(saved.error, '태그를 저장하지 못했어요. 다시 시도해 주세요.');
    }
  }
}

async function findOrCreateTag(name: string, cache: Map<string, Pick<TagRow, 'id' | 'name'>>): Promise<string> {
  const key = tagKey(name);
  const cached = cache.get(key);
  if (cached) {
    return cached.id;
  }

  const inserted = await supabase.from('tags').insert({ name }).select('id, name').maybeSingle();
  if (!inserted.error && inserted.data) {
    cache.set(key, inserted.data);
    return inserted.data.id;
  }
  if (inserted.error && inserted.error.code !== '23505') {
    throwDataError(inserted.error, '태그를 만들지 못했어요. 다시 시도해 주세요.');
  }

  const listed = await supabase.from('tags').select('id, name');
  if (listed.error) {
    throwDataError(listed.error, '태그를 찾지 못했어요. 다시 시도해 주세요.');
  }
  const found = (listed.data ?? []).find((tag) => tagKey(tag.name) === key);
  if (!found) {
    throwDataError(inserted.error, '태그를 만들지 못했어요. 다시 시도해 주세요.');
  }
  cache.set(key, found);
  return found.id;
}
