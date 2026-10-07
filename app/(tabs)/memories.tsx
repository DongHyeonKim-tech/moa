import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MemoCard } from '@/components/memo/MemoCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useMemoActions } from '@/hooks/useMemoActions';
import { composeMemoryFeed, pickRandomMemo, randomMemoPool } from '@/services/memoryService';
import { useMemoStore } from '@/store/memoStore';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius, spacing } from '@/theme/tokens';
import type { Memo } from '@/types/memo';

export default function MemoriesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const memos = useMemoStore((state) => state.memos);
  const { open, sheet } = useMemoActions();
  const sections = useMemo(() => composeMemoryFeed(memos), [memos]);
  const pool = useMemo(() => randomMemoPool(memos), [memos]);
  const [randomId, setRandomId] = useState<string | null>(null);

  useEffect(() => {
    if (pool.length === 0) {
      setRandomId(null);
      return;
    }

    setRandomId((current) => {
      if (current && pool.some((memo) => memo.id === current)) {
        return current;
      }
      return pickRandomMemo(pool)?.id ?? null;
    });
  }, [pool]);

  const randomMemo = pool.find((memo) => memo.id === randomId) ?? null;
  const hasAnything = sections.length > 0 || randomMemo !== null;

  const openMemo = (memo: Memo) => {
    router.push({ pathname: '/memo/[id]', params: { id: memo.id } });
  };

  return (
    <Screen>
      <ScreenHeader large title="기억" subtitle="지나간 기록이 다시 찾아옵니다." />
      {hasAnything ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {sections.map((section) => (
            <View key={section.id}>
              <SectionHeader title={section.title} description={section.description} />
              <View style={styles.stack}>
                {section.memos.map((memo) => (
                  <MemoCard
                    key={memo.id}
                    memo={memo}
                    onPress={() => openMemo(memo)}
                    onLongPress={() => open(memo)}
                  />
                ))}
              </View>
            </View>
          ))}
          {randomMemo ? (
            <View>
              <SectionHeader title="랜덤 메모" description="오래 보지 않았을 수도 있는 기록이에요." />
              <MemoCard memo={randomMemo} onPress={() => openMemo(randomMemo)} onLongPress={() => open(randomMemo)} />
              {pool.length > 1 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setRandomId(pickRandomMemo(pool, randomMemo.id)?.id ?? randomMemo.id)}
                  style={({ pressed }) => [
                    styles.shuffle,
                    { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                  ]}>
                  <Text style={[styles.shuffleLabel, { color: colors.accentText }]}>다른 메모</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      ) : (
        <EmptyState
          title="다시 만날 기억이 아직 없어요."
          description="기록이 쌓이면, 지나간 메모가 여기로 돌아옵니다."
        />
      )}
      {sheet}
    </Screen>
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
  shuffle: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  shuffleLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
});
