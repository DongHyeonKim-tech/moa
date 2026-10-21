import { cleanSummary } from '@/services/tagPolicy';
import type { DraftedMemo, MemoAnalysis } from '@/types/ai';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseAnalysisResponse(value: unknown): MemoAnalysis | null {
  if (!isRecord(value) || !Array.isArray(value.tags)) {
    return null;
  }
  const tags = value.tags.filter((tag): tag is string => typeof tag === 'string');
  if (tags.length !== value.tags.length) {
    return null;
  }
  const summary = typeof value.summary === 'string' ? cleanSummary(value.summary) : null;
  return { tags, summary };
}

export function parseMarkdownResponse(value: unknown): string | null {
  if (!isRecord(value) || typeof value.markdown !== 'string') {
    return null;
  }
  const markdown = value.markdown.trim();
  return markdown.length > 0 ? value.markdown.trim() : null;
}

export function parseDraftResponse(value: unknown): DraftedMemo | null {
  if (!isRecord(value) || typeof value.markdown !== 'string') {
    return null;
  }
  const markdown = value.markdown.trim();
  if (!markdown) {
    return null;
  }
  const title = typeof value.title === 'string' ? value.title.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
  return { title, markdown };
}

export function parseRelatedResponse(value: unknown): { id: string; related: boolean; reason: string }[] | null {
  if (!isRecord(value) || !Array.isArray(value.results)) {
    return null;
  }
  const results: { id: string; related: boolean; reason: string }[] = [];
  for (const item of value.results) {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.related !== 'boolean') {
      return null;
    }
    results.push({
      id: item.id,
      related: item.related,
      reason: typeof item.reason === 'string' ? item.reason.trim() : '',
    });
  }
  return results;
}
