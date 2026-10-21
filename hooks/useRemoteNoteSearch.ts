import { useEffect, useState } from 'react';

import { userFacingError } from '@/services/dataError';
import { useMemoStore } from '@/store/memoStore';
import type { Memo } from '@/types/memo';

export function useRemoteNoteSearch(query: string) {
  const searchNotes = useMemoStore((state) => state.searchNotes);
  const [hits, setHits] = useState<Memo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setHits(null);
      setError(null);
      setLoading(false);
      return undefined;
    }

    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      void searchNotes(trimmed)
        .then((memos) => {
          if (!active) {
            return;
          }
          setHits(memos);
          setError(null);
        })
        .catch((cause: unknown) => {
          if (!active) {
            return;
          }
          setHits(null);
          setError(userFacingError(cause));
        })
        .finally(() => {
          if (active) {
            setLoading(false);
          }
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [attempt, query, searchNotes]);

  return {
    hits,
    error,
    loading,
    retry: () => setAttempt((current) => current + 1),
  };
}
