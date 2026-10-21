import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { MemoCard } from '@/components/memo/MemoCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useCreateMemo } from '@/hooks/useCreateMemo';
import { useMemoActions } from '@/hooks/useMemoActions';
import { selectRediscovery } from '@/services/memoryService';
import { activeMemos, pinnedMemos, recentMemos } from '@/services/memoQuery';
import { scheduleMemoAnalysis } from '@/services/memoAnalysis';
import { selectHomeRelated } from '@/services/relatedNotes';
import { useMemoStore } from '@/store/memoStore';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius, spacing } from '@/theme/tokens';
import type { Memo } from '@/types/memo';
import { createId } from '@/utils/id';

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const memos = useMemoStore((state) => state.memos);
  const relations = useMemoStore((state) => state.relations);
  const saveDraft = useMemoStore((state) => state.saveDraft);
  const createMemo = useCreateMemo();
  const { open, sheet } = useMemoActions();
  const [quick, setQuick] = useState('');
  const rediscovery = selectRediscovery(memos);
  const pinned = pinnedMemos(memos).filter((memo) => memo.id !== rediscovery?.memo.id);
  const recent = recentMemos(memos).filter((memo) => memo.id !== rediscovery?.memo.id);
  const related = selectHomeRelated(memos, relations);
  const hasMemos = activeMemos(memos).length > 0;

  const saveQuick = async () => {
    const text = quick.trim();
    if (!text) {
      createMemo();
      return;
    }
    const id = createId();
    setQuick('');
    const result = await saveDraft(id, { title: '', contentMarkdown: text, userTags: [] });
    if (result === 'failed') {
      setQuick(text);
      return;
    }
    scheduleMemoAnalysis(id);
    router.push({ pathname: '/memo/[id]', params: { id } });
  };

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
        title="moa"
        right={
          <>
            <IconButton icon="search" label="검색" onPress={() => router.push('/search')} />
            <IconButton icon="settings" label="설정" onPress={() => router.push('/settings')} />
          </>
        }
      />
      <View style={styles.quickWrap}>
        <TextInput
          value={quick}
          onChangeText={setQuick}
          placeholder="떠오른 생각을 적어보세요"
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accent}
          returnKeyType="done"
          onSubmitEditing={() => {
            void saveQuick();
          }}
          style={[styles.quick, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
        />
        <Pressable accessibilityRole="button" onPress={() => router.push('/draft')} style={styles.aiLink}>
          <Text style={[styles.aiLabel, { color: colors.accentText }]}>AI로 메모 쓰기</Text>
        </Pressable>
      </View>
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
          {related.length > 0 ? (
            <View>
              <SectionHeader title="비슷한 메모" description="겹치는 주제가 있는 기록이에요. 연결은 직접 할 수 있어요." />
              <View style={styles.stack}>
                {related.map((item) => (
                  <MemoCard
                    key={`${item.source.id}-${item.related.id}`}
                    memo={item.related}
                    eyebrow={item.reason}
                    onPress={() => openMemo(item.related)}
                    onLongPress={() => open(item.related)}
                  />
                ))}
              </View>
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
  quickWrap: {
    paddingHorizontal: layout.pagePadding,
    paddingBottom: spacing.md,
  },
  quick: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    lineHeight: 22,
  },
  aiLink: {
    alignSelf: 'flex-start',
    minHeight: 36,
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  aiLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: layout.pagePadding,
    paddingBottom: layout.fabClearance,
  },
  stack: {
    gap: spacing.md,
  },
});
