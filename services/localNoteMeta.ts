import AsyncStorage from '@react-native-async-storage/async-storage';

import { metaFromMemo, type LocalNoteMeta } from '@/services/noteMapper';
import type { Memo } from '@/types/memo';

const STORAGE_KEY = 'moa.note-meta.v1';

export async function loadNoteMeta(): Promise<Record<string, LocalNoteMeta>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    return parsed as Record<string, LocalNoteMeta>;
  } catch {
    return {};
  }
}

export async function writeNoteMeta(memo: Memo): Promise<void> {
  const all = await loadNoteMeta();
  all[memo.id] = metaFromMemo(memo);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export async function removeNoteMeta(id: string): Promise<void> {
  const all = await loadNoteMeta();
  if (!all[id]) {
    return;
  }
  delete all[id];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
