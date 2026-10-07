import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { createId } from '@/utils/id';

export function useCreateMemo() {
  const router = useRouter();

  return useCallback(() => {
    router.push({
      pathname: '/memo/[id]',
      params: { id: createId() },
    });
  }, [router]);
}
