const DAY_MS = 86_400_000;

export function calendarDayDiff(from: Date, to: Date): number {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((end - start) / DAY_MS);
}

export function calendarDaysBetween(iso: string, now: Date): number {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  return calendarDayDiff(date, now);
}

export function formatFullDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export function formatRelativeTime(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  if (now.getTime() < date.getTime()) {
    return formatFullDate(iso);
  }

  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) {
    return '방금';
  }
  if (minutes < 60) {
    return `${minutes}분 전`;
  }

  const days = calendarDaysBetween(iso, now);
  if (days <= 0) {
    return `${Math.floor(minutes / 60)}시간 전`;
  }
  if (days === 1) {
    return '어제';
  }
  if (days < 7) {
    return `${days}일 전`;
  }
  if (days < 30) {
    return `${Math.floor(days / 7)}주 전`;
  }
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
  }

  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export function formatRediscoveryCaption(iso: string, now = new Date()): string {
  const days = Math.max(0, calendarDaysBetween(iso, now));
  if (days < 45) {
    return `${days}일 전에 이런 생각을 기록했어요.`;
  }

  const months = Math.max(1, Math.round(days / 30.44));
  if (months < 12) {
    return `${months}개월 전에 이런 생각을 기록했어요.`;
  }

  const years = Math.max(1, Math.round(months / 12));
  return `${years}년 전에 이런 생각을 기록했어요.`;
}

export function dateKey(now: Date): string {
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}
