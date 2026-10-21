import { supabase } from '@/lib/supabase';
import { AppDataError, throwDataError } from '@/services/dataError';

export async function ensureAnonymousSession(): Promise<void> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throwDataError(error, '로그인 상태를 확인하지 못했어요. 다시 시도해 주세요.');
  }
  if (data.session) {
    return;
  }

  const signed = await supabase.auth.signInAnonymously();
  if (signed.error || !signed.data.session) {
    throwDataError(signed.error, '익명 로그인에 실패했어요. Supabase에서 Anonymous Sign-ins를 켜 주세요.');
  }
}

export async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throwDataError(error, '로그인이 필요해요. 다시 시도해 주세요.');
  }
  const userId = data.session?.user.id;
  if (!userId) {
    throw new AppDataError('로그인이 필요해요. 다시 시도해 주세요.');
  }
  return userId;
}
