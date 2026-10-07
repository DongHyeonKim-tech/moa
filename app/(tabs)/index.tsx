import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { MemoCard } from '@/components/memo/MemoCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useCreateMemo } from '@/hooks/useCreateMemo';
import { useMemoActions } from '@/hooks/useMemoActions';
import { selectRediscovery } from '@/services/memoryService';
import { activeMemos, pinnedMemos, recentMemos } from '@/services/memoQuery';
import { useMemoStore } from '@/store/memoStore';
import { layout, spacing } from '@/theme/tokens';
import type { Memo } from '@/types/memo';

export default function HomeScreen() {
  const router = useRouter();
  const memos = useMemoStore((state) => state.memos);
  const createMemo = useCreateMemo();
  const { open, sheet } = useMemoActions();
  const rediscovery = selectRediscovery(memos);
  const pinned = pinnedMemos(memos).filter((memo) => memo.id !== rediscovery?.memo.id);
  const recent = recentMemos(memos).filter((memo) => memo.id !== rediscovery?.memo.id);
  const hasMemos = activeMemos(memos).length > 0;

  const openMemo = (memo: Memo) => {
    router.push({ pathname: '/memo/[id]', params: { id: memo.id } });
  };

  const openNotes = () => {
    router.push('/notes');
  };

  return (
    <Screen>
      <ScreenHeader
        large
        title="Moa"
        right={
          <>
            <IconButton icon="search" label="검색" onPress={() => router.push('/search')} />
            <IconButton icon="settings" label="설정" onPress={() => router.push('/settings')} />
          </>
        }
      />
      {hasMemos ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {rediscovery ? (
            <View>
              <SectionHeader
                title="다시 발견한 메모"
                actionLabel={pinned.length === 0 && recent.length === 0 ? '모두 보기' : undefined}
                onAction={openNotes}
              />
              <MemoCard
                memo={rediscovery.memo}
                eyebrow={rediscovery.caption}
                onPress={() => openMemo(rediscovery.memo)}
                onLongPress={() => open(rediscovery.memo)}
              />
            </View>
          ) : null}
          {pinned.length > 0 ? (
            <View>
              <SectionHeader
                title="고정된 메모"
                actionLabel={recent.length === 0 ? '모두 보기' : undefined}
                onAction={openNotes}
              />
              <MemoStack memos={pinned} onPress={openMemo} onLongPress={open} />
            </View>
          ) : null}
          {recent.length > 0 ? (
            <View>
              <SectionHeader title="최근 메모" actionLabel="모두 보기" onAction={openNotes} />
              <MemoStack memos={recent} onPress={openMemo} onLongPress={open} />
            </View>
          ) : null}
        </ScrollView>
      ) : (
        <EmptyState
          title="아직 기록된 메모가 없어요."
          description="지금 떠오른 생각을 기록해보세요."
          actionLabel="첫 메모 작성하기"
          onAction={createMemo}
        />
      )}
      {sheet}
    </Screen>
  );
}

function MemoStack({
  memos,
  onPress,
  onLongPress,
}: {
  memos: Memo[];
  onPress: (memo: Memo) => void;
  onLongPress: (memo: Memo) => void;
}) {
  return (
    <View style={styles.stack}>
      {memos.map((memo) => (
        <MemoCard key={memo.id} memo={memo} onPress={() => onPress(memo)} onLongPress={() => onLongPress(memo)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.pagePadding,
    paddingBottom: layout.fabClearance,
  },
  stack: {
    gap: spacing.md,
  },
});
