import {
  buildAnalyzePayload,
  buildDraftPayload,
  buildMergePayload,
  buildOrganizePayload,
  buildRelatedPayload,
} from '@/services/aiPayload';
import { parseAnalysisResponse, parseDraftResponse, parseMarkdownResponse, parseRelatedResponse } from '@/services/aiParse';
import { useSettingsStore } from '@/store/settingsStore';
import type { DraftedMemo, MemoAnalysis, OrganizeMode } from '@/types/ai';
import type { Memo } from '@/types/memo';

const TIMEOUT_MS = 30_000;

export type AiErrorCode = 'unconfigured' | 'unauthorized' | 'network' | 'limited' | 'invalid' | 'upstream' | 'too_large';

export class AiError extends Error {
  readonly code: AiErrorCode;

  constructor(message: string, code: AiErrorCode) {
    super(message);
    this.name = 'AiError';
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function codeFromStatus(status: number, value: unknown): AiErrorCode {
  if (isRecord(value) && typeof value.code === 'string') {
    if (
      value.code === 'unconfigured' ||
      value.code === 'unauthorized' ||
      value.code === 'network' ||
      value.code === 'limited' ||
      value.code === 'invalid' ||
      value.code === 'upstream' ||
      value.code === 'too_large'
    ) {
      return value.code;
    }
  }
  if (status === 401) {
    return 'unauthorized';
  }
  if (status === 413) {
    return 'too_large';
  }
  if (status === 429) {
    return 'limited';
  }
  if (status === 503) {
    return 'unconfigured';
  }
  return 'upstream';
}

async function post(path: string, body: unknown): Promise<unknown> {
  const settings = useSettingsStore.getState();
  const base = settings.aiProxyUrl.trim().replace(/\/$/, '');
  if (!base.startsWith('http://') && !base.startsWith('https://')) {
    throw new AiError('AI 서버 주소가 필요해요. 설정에서 주소를 확인해 주세요.', 'unconfigured');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const token = settings.aiProxyToken.trim();
    const response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = isRecord(payload) && typeof payload.error === 'string' ? payload.error : '요청을 처리하지 못했어요.';
      throw new AiError(message, codeFromStatus(response.status, payload));
    }
    return payload;
  } catch (error) {
    if (error instanceof AiError) {
      throw error;
    }
    throw new AiError('AI 서버에 연결하지 못했어요. 주소와 네트워크를 확인해 주세요.', 'network');
  } finally {
    clearTimeout(timer);
  }
}

export async function checkAiHealth(): Promise<{ reachable: boolean; aiConfigured: boolean }> {
  const settings = useSettingsStore.getState();
  const base = settings.aiProxyUrl.trim().replace(/\/$/, '');
  if (!base.startsWith('http://') && !base.startsWith('https://')) {
    return { reachable: false, aiConfigured: false };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const token = settings.aiProxyToken.trim();
    const response = await fetch(`${base}/v1/health`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok || !isRecord(payload)) {
      return { reachable: false, aiConfigured: false };
    }
    return { reachable: true, aiConfigured: payload.aiConfigured === true };
  } catch {
    return { reachable: false, aiConfigured: false };
  } finally {
    clearTimeout(timer);
  }
}

export async function organizeMemo(content: string, mode: OrganizeMode): Promise<string> {
  const payload = buildOrganizePayload(content, mode);
  if (!payload.ok) {
    throw new AiError(payload.message, 'invalid');
  }
  const markdown = parseMarkdownResponse(await post('/v1/organize', payload.body));
  if (!markdown) {
    throw new AiError('정리 결과를 읽지 못했어요.', 'upstream');
  }
  return markdown;
}

export async function analyzeMemo(title: string, content: string): Promise<MemoAnalysis> {
  const payload = buildAnalyzePayload(title, content);
  if (!payload.ok) {
    throw new AiError(payload.message, 'too_large');
  }
  const analysis = parseAnalysisResponse(await post('/v1/analyze', payload.body));
  if (!analysis) {
    throw new AiError('요약 결과를 읽지 못했어요.', 'upstream');
  }
  return analysis;
}

export async function evaluateRelatedNotes(
  memo: Pick<Memo, 'id' | 'title' | 'aiSummary' | 'tags'>,
  candidates: readonly Pick<Memo, 'id' | 'title' | 'aiSummary' | 'tags'>[],
): Promise<{ id: string; related: boolean; reason: string }[]> {
  const payload = buildRelatedPayload(memo, candidates);
  const results = parseRelatedResponse(await post('/v1/related', payload));
  if (!results) {
    throw new AiError('비슷한 메모 결과를 읽지 못했어요.', 'upstream');
  }
  return results;
}

export async function draftMemo(prompt: string, context?: string): Promise<DraftedMemo> {
  const payload = buildDraftPayload(prompt, context);
  if (!payload.ok) {
    throw new AiError(payload.message, payload.message.includes('길') ? 'too_large' : 'invalid');
  }
  const draft = parseDraftResponse(await post('/v1/draft', payload.body));
  if (!draft) {
    throw new AiError('작성 결과를 읽지 못했어요.', 'upstream');
  }
  return draft;
}

export async function mergeMemos(memos: readonly Pick<Memo, 'id' | 'title' | 'contentMarkdown'>[]): Promise<string> {
  const payload = buildMergePayload(memos);
  if (!payload.ok) {
    throw new AiError(payload.message, payload.message.includes('길') ? 'too_large' : 'invalid');
  }
  const markdown = parseMarkdownResponse(await post('/v1/merge', payload.body));
  if (!markdown) {
    throw new AiError('모아보기 결과를 읽지 못했어요.', 'upstream');
  }
  return markdown;
}

export function aiErrorMessage(error: unknown): string {
  if (error instanceof AiError) {
    if (error.code === 'unconfigured') {
      return 'AI 서버에 키가 없거나 주소가 필요해요. 설정에서 안내를 확인해 주세요.';
    }
    if (error.code === 'unauthorized') {
      return 'AI 서버 인증에 실패했어요. 설정에 접근 토큰을 확인해 주세요.';
    }
    if (error.code === 'limited') {
      return '요청이 많아요. 잠시 후 다시 시도해 주세요.';
    }
    return error.message;
  }
  return '요청을 처리하지 못했어요.';
}
