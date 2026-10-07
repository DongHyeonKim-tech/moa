import { useRouter } from 'expo-router';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { MemoCard } from '@/components/memo/MemoCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { deletedMemos } from '@/services/memoQuery';
import { useMemoStore } from '@/store/memoStore';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, spacing } from '@/theme/tokens';
import type { Memo } from '@/types/memo';

export default function TrashScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const memos = useMemoStore((state) => state.memos);
  const restore = useMemoStore((state) => state.restore);
  const deleteForever = useMemoStore((state) => state.deleteForever);
  const emptyTrash = useMemoStore((state) => state.emptyTrash);
  const trashed = deletedMemos(memos);

  const confirmEmpty = () => {
    Alert.alert('휴지통을 비울까요?', '휴지통의 메모가 모두 영구 삭제됩니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '비우기',
        style: 'destructive',
        onPress: () => {
          void emptyTrash();
        },
      },
    ]);
  };

  const confirmDelete = (memo: Memo) => {
    Alert.alert('이 메모를 영구 삭제할까요?', '삭제한 메모는 복원할 수 없어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '영구 삭제',
        style: 'destructive',
        onPress: () => {
          void deleteForever(memo.id);
        },
      },
    ]);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader
        title="휴지통"
        left={<IconButton icon="back" label="뒤로" onPress={() => router.back()} />}
        right={
          trashed.length > 0 ? (
            <Pressable accessibilityRole="button" hitSlop={8} onPress={confirmEmpty} style={styles.emptyButton}>
              <Text style={[styles.emptyLabel, { color: colors.danger }]}>비우기</Text>
            </Pressable>
          ) : null
        }
      />
      <FlatList
        data={trashed}
        keyExtractor={(item) => item.id}
        style={styles.fill}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <MemoCard memo={item} onPress={() => router.push({ pathname: '/memo/[id]', params: { id: item.id } })} />
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" onPress={() => void restore(item.id)} hitSlop={6}>
                <Text style={[styles.action, { color: colors.accentText }]}>복원</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => confirmDelete(item)} hitSlop={6}>
                <Text style={[styles.action, { color: colors.danger }]}>영구 삭제</Text>
              </Pressable>
            </View>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<EmptyState title="휴지통이 비어 있어요." description="삭제한 메모가 여기로 이동해요." />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  emptyButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingLeft: spacing.sm,
  },
  emptyLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  fill: {
    flex: 1,
  },
  list: {
    flexGrow: 1,
    paddingHorizontal: layout.pagePadding,
    paddingBottom: spacing.xxxl,
  },
  item: {
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.lg,
    paddingRight: spacing.xs,
  },
  action: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  separator: {
    height: spacing.lg,
  },
});
