import { toPlainText } from '@/services/markdown';
import type { Memo } from '@/types/memo';

export function displayTitle(memo: Pick<Memo, 'title' | 'contentMarkdown'>): string {
  const title = memo.title.trim();
  if (title) {
    return title;
  }

  const firstLine = toPlainText(memo.contentMarkdown)
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) {
    return '제목 없음';
  }

  return firstLine.length > 48 ? `${firstLine.slice(0, 48)}…` : firstLine;
}

export function displayPreview(memo: Pick<Memo, 'title' | 'contentMarkdown' | 'aiSummary'>): string {
  if (memo.aiSummary?.trim()) {
    return memo.aiSummary.trim();
  }

  const lines = toPlainText(memo.contentMarkdown)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (memo.title.trim()) {
    return lines.join(' ');
  }

  return lines.slice(1).join(' ');
}
