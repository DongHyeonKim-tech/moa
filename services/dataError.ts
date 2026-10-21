export class AppDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppDataError';
  }
}

type ErrorLike = {
  message?: string;
  code?: string;
  details?: string;
};

export function userFacingError(error: unknown): string {
  if (error instanceof AppDataError) {
    return error.message;
  }

  const value = error as ErrorLike | null;
  const message = typeof value?.message === 'string' ? value.message : '';
  const code = typeof value?.code === 'string' ? value.code : '';
  const combined = `${code} ${message}`.toLowerCase();

  if (combined.includes('anonymous') && combined.includes('disabled')) {
    return '익명 로그인이 꺼져 있어요. Supabase에서 Anonymous Sign-ins를 켜 주세요.';
  }
  if (combined.includes('failed to fetch') || combined.includes('network request failed') || combined.includes('network')) {
    return '네트워크에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.';
  }
  if (code === '42501' || combined.includes('row-level security') || combined.includes('permission')) {
    return '이 기록에 접근할 수 없어요.';
  }
  if (code === '23505') {
    return '같은 항목이 이미 있어요. 다시 시도해 주세요.';
  }
  if (message) {
    return '요청을 끝내지 못했어요. 다시 시도해 주세요.';
  }
  return '요청을 끝내지 못했어요. 다시 시도해 주세요.';
}

export function throwDataError(error: ErrorLike | null, fallback: string): never {
  if (!error) {
    throw new AppDataError(fallback);
  }
  const message = userFacingError(error);
  if (message !== '요청을 끝내지 못했어요. 다시 시도해 주세요.') {
    throw new AppDataError(message);
  }
  throw new AppDataError(fallback);
}
