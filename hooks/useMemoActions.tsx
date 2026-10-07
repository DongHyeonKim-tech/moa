import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { MemoActionSheet } from '@/components/memo/MemoActionSheet';
import { useMemoStore } from '@/store/memoStore';
import type { Memo } from '@/types/memo';

export function useMemoActions() {
  const [target, setTarget] = useState<Memo | null>(null);
  const togglePin = useMemoStore((state) => state.togglePin);
  const toggleFavorite = useMemoStore((state) => state.toggleFavorite);
  const moveToTrash = useMemoStore((state) => state.moveToTrash);

  const open = useCallback((memo: Memo) => {
    setTarget(memo);
  }, []);

  const close = useCallback(() => {
    setTarget(null);
  }, []);

  const confirmDelete = useCallback(
    (memo: Memo) => {
      Alert.alert('메모를 휴지통으로 옮길까요?', '휴지통에서 다시 복원할 수 있어요.', [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            void moveToTrash(memo.id);
          },
        },
      ]);
    },
    [moveToTrash],
  );

  const sheet = (
    <MemoActionSheet
      memo={target}
      onClose={close}
      onTogglePin={() => {
        if (!target) {
          return;
        }
        void togglePin(target.id);
        close();
      }}
      onToggleFavorite={() => {
        if (!target) {
          return;
        }
        void toggleFavorite(target.id);
        close();
      }}
      onDelete={() => {
        if (!target) {
          return;
        }
        const memo = target;
        close();
        confirmDelete(memo);
      }}
    />
  );

  return { open, confirmDelete, sheet };
}
