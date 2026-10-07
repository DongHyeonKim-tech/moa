import type { Memo } from '@/types/memo';
import { calendarDayDiff, calendarDaysBetween, dateKey, formatRediscoveryCaption } from '@/utils/date';
import { hashString } from '@/utils/id';

/** Oldest note that can surface as something worth rediscovering. */
export const REDISCOVERY_MIN_AGE_DAYS = 30;
/** Idle time before a note is treated as forgotten. */
export const FORGOTTEN_MIN_IDLE_DAYS = 30;
/** Random recall prefers notes that are no longer from today. */
export const RANDOM_MIN_AGE_DAYS = 7;
const ANNIVERSARY_WINDOW_DAYS = 3;
const SECTION_LIMIT = 5;

export type MemorySection = {
  id: string;
  title: string;
  description: string;
  memos: Memo[];
};

export type Rediscovery = {
  memo: Memo;
  caption: string;
};

function activeMemos(memos: readonly Memo[]): Memo[] {
  return memos.filter((memo) => !memo.isDeleted);
}

export function lastActivityIso(memo: Memo): string {
  if (memo.lastViewedAt && memo.lastViewedAt > memo.updatedAt) {
    return memo.lastViewedAt;
  }
  return memo.updatedAt;
}

function anniversaryDistance(iso: string, now: Date): number | null {
  const created = new Date(iso);
  if (Number.isNaN(created.getTime()) || created.getFullYear() >= now.getFullYear()) {
    return null;
  }

  const anniversary = new Date(now.getFullYear(), created.getMonth(), created.getDate());
  return Math.abs(calendarDayDiff(anniversary, now));
}

export function selectRediscovery(memos: readonly Memo[], now = new Date()): Rediscovery | null {
  const eligible = activeMemos(memos)
    .filter((memo) => calendarDaysBetween(memo.createdAt, now) >= REDISCOVERY_MIN_AGE_DAYS)
    .sort((left, right) => left.id.localeCompare(right.id));

  if (eligible.length === 0) {
    return null;
  }

  const index = hashString(dateKey(now)) % eligible.length;
  const memo = eligible[index];
  if (!memo) {
    return null;
  }

  return {
    memo,
    caption: formatRediscoveryCaption(memo.createdAt, now),
  };
}

/**
 * Rule-based memory feed. Later AI recommendations can append sections here
 * without changing the screen that renders this list.
 */
export function composeMemoryFeed(memos: readonly Memo[], now = new Date()): MemorySection[] {
  const active = activeMemos(memos);
  const sections: MemorySection[] = [];

  const exact = active.filter((memo) => anniversaryDistance(memo.createdAt, now) === 0);
  const similar =
    exact.length > 0
      ? []
      : active.filter((memo) => {
          const distance = anniversaryDistance(memo.createdAt, now);
          return distance !== null && distance > 0 && distance <= ANNIVERSARY_WINDOW_DAYS;
        });
  const onThisDay = (exact.length > 0 ? exact : similar)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, SECTION_LIMIT);

  if (onThisDay.length > 0) {
    sections.push({
      id: 'onThisDay',
      title: '과거의 오늘',
      description: exact.length > 0 ? '이 날짜에 남긴 기록이에요.' : '비슷한 시기에 남긴 기록이에요.',
      memos: onThisDay,
    });
  }

  const forgotten = active
    .filter((memo) => calendarDaysBetween(lastActivityIso(memo), now) >= FORGOTTEN_MIN_IDLE_DAYS)
    .sort((left, right) => lastActivityIso(left).localeCompare(lastActivityIso(right)))
    .slice(0, SECTION_LIMIT);

  if (forgotten.length > 0) {
    sections.push({
      id: 'forgotten',
      title: '잊고 있던 메모',
      description: '한동안 열지 않은 기록이에요.',
      memos: forgotten,
    });
  }

  return sections;
}

export function randomMemoPool(memos: readonly Memo[], now = new Date()): Memo[] {
  return activeMemos(memos).filter((memo) => calendarDaysBetween(memo.createdAt, now) >= RANDOM_MIN_AGE_DAYS);
}

export function pickRandomMemo(pool: readonly Memo[], currentId?: string): Memo | null {
  if (pool.length === 0) {
    return null;
  }

  const candidates = currentId ? pool.filter((memo) => memo.id !== currentId) : pool;
  const source = candidates.length > 0 ? candidates : pool;
  const index = Math.floor(Math.random() * source.length);
  return source[index] ?? null;
}
