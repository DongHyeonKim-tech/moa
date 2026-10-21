import { isAcceptedLink, isClosedLink } from '@/services/noteMapper';
import type { MemoRelation } from '@/types/memo';

export function orderedPair(leftId: string, rightId: string): [string, string] | null {
  if (leftId === rightId) {
    return null;
  }
  return leftId < rightId ? [leftId, rightId] : [rightId, leftId];
}

export function findRelation(
  relations: readonly MemoRelation[],
  leftId: string,
  rightId: string,
): MemoRelation | undefined {
  const pair = orderedPair(leftId, rightId);
  if (!pair) {
    return undefined;
  }
  return relations.find(
    (relation) =>
      relation.relationType === 'LINK' && relation.sourceMemoId === pair[0] && relation.targetMemoId === pair[1],
  );
}

export function planLink(
  relations: readonly MemoRelation[],
  leftId: string,
  rightId: string,
  id: string,
  now: string,
): MemoRelation | null {
  const pair = orderedPair(leftId, rightId);
  const existing = pair ? findRelation(relations, leftId, rightId) : undefined;
  if (!pair || (existing && isAcceptedLink(existing.status))) {
    return null;
  }

  return {
    id,
    sourceMemoId: pair[0],
    targetMemoId: pair[1],
    relationType: 'LINK',
    createdAt: now,
  };
}

export function linkedMemoIds(memoId: string, relations: readonly MemoRelation[]): string[] {
  return counterpartIds(memoId, relations, (relation) => isAcceptedLink(relation.status));
}

export function closedMemoIds(memoId: string, relations: readonly MemoRelation[]): string[] {
  return counterpartIds(memoId, relations, (relation) => isClosedLink(relation.status));
}

function counterpartIds(
  memoId: string,
  relations: readonly MemoRelation[],
  include: (relation: MemoRelation) => boolean,
): string[] {
  const ids: string[] = [];
  for (const relation of relations) {
    if (relation.relationType !== 'LINK' || !include(relation)) {
      continue;
    }
    if (relation.sourceMemoId === memoId) {
      ids.push(relation.targetMemoId);
    } else if (relation.targetMemoId === memoId) {
      ids.push(relation.sourceMemoId);
    }
  }
  return ids;
}
