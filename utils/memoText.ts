import type { Memo } from '@/types/memo';

export function displayTitle(memo: Pick<Memo, 'title' | 'content'>): string {
  const title = memo.title.trim();
  if (title) {
    return title;
  }

  const firstLine = memo.content
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) {
    return '제목 없음';
  }

  return firstLine.length > 48 ? `${firstLine.slice(0, 48)}…` : firstLine;
}

export function displayPreview(memo: Pick<Memo, 'title' | 'content'>): string {
  const lines = memo.content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (memo.title.trim()) {
    return lines.join(' ');
  }

  return lines.slice(1).join(' ');
}
