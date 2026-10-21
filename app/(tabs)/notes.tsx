import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MemoCard } from '@/components/memo/MemoCard';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { SearchField } from '@/components/ui/SearchField';
import { useCreateMemo } from '@/hooks/useCreateMemo';
import { useMemoActions } from '@/hooks/useMemoActions';
import { useRemoteNoteSearch } from '@/hooks/useRemoteNoteSearch';
import { activeMemos, collectTags, listMemos } from '@/services/memoQuery';
import { useMemoStore } from '@/store/memoStore';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, spacing } from '@/theme/tokens';
import type { Memo, MemoCollectionFilter, MemoSort } from '@/types/memo';

const filters: { id: MemoCollectionFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'favorites', label: '즐겨찾기' },
  { id: 'pinned', label: '고정' },
];

export default function NotesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const memos = useMemoStore((state) => state.memos);
  const createMemo = useCreateMemo();
  const { open, sheet } = useMemoActions();
  const [query, setQuery] = useState('');
  const remoteSearch = useRemoteNoteSearch(query);
  const [filter, setFilter] = useState<MemoCollectionFilter>('all');
  const [tag, setTag] = useState<string | null>(null);
  const [sort, setSort] = useState<MemoSort>('newest');
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const tags = useMemo(() => collectTags(memos), [memos]);
  const visible = useMemo(() => {
    const listed = listMemos(memos, { filter, tag, query: remoteSearch.hits ? '' : query, sort });
    if (!remoteSearch.hits) {
      return listed;
    }
    const allowed = new Set(remoteSearch.hits.map((memo) => memo.id));
    return listed.filter((memo) => allowed.has(memo.id));
  }, [filter, memos, query, remoteSearch.hits, sort, tag]);
  const hasMemos = activeMemos(memos).length > 0;
  const filtering = query.trim().length > 0 || filter !== 'all' || tag !== null;

  return (
    <Screen>
      <ScreenHeader
        large
        title="메모"
        right={
          <View style={styles.headerActions}>
            {selecting ? null : (
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setSort((current) => (current === 'newest' ? 'oldest' : 'newest'))}
                style={styles.sortButton}>
                <Text style={[styles.sortLabel, { color: colors.accent }]}>{sort === 'newest' ? '최신순' : '오래된순'}</Text>
              </Pressable>
            )}
            {selecting ? null : (
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push('/draft')} style={styles.sortButton}>
                <Text style={[styles.sortLabel, { color: colors.accent }]}>AI 작성</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                setSelecting((current) => !current);
                setSelectedIds([]);
              }}
              style={styles.sortButton}>
              <Text style={[styles.sortLabel, { color: colors.accent }]}>{selecting ? '취소' : '선택'}</Text>
            </Pressable>
          </View>
        }
      />
      <View style={styles.tools}>
        <SearchField value={query} onChangeText={setQuery} placeholder="메모 검색" />
        {remoteSearch.error ? (
          <Pressable accessibilityRole="button" onPress={remoteSearch.retry}>
            <Text style={[styles.sortLabel, { color: colors.danger }]}>{`${remoteSearch.error} 다시 시도`}</Text>
          </Pressable>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {filters.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              selected={filter === item.id}
              onPress={() => setFilter(item.id)}
            />
          ))}
        </ScrollView>
        {tags.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {tags.map((item) => (
              <Chip
                key={item}
                label={`#${item}`}
                selected={tag === item}
                onPress={() => setTag((current) => (current === item ? null : item))}
              />
            ))}
          </ScrollView>
        ) : null}
      </View>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        style={styles.fill}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <MemoCard
            memo={item}
            selected={selectedIds.includes(item.id)}
            onPress={() => {
              if (!selecting) {
                openMemo(router, item);
                return;
              }
              setSelectedIds((current) =>
                current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id],
              );
            }}
            onLongPress={() => {
              if (selecting) {
                return;
              }
              open(item);
            }}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          hasMemos && filtering ? (
            <EmptyState title="조건에 맞는 메모가 없어요." description="다른 필터나 검색어를 시도해보세요." />
          ) : (
            <EmptyState
              title="아직 기록된 메모가 없어요."
              description="지금 떠오른 생각을 기록해보세요."
              actionLabel="첫 메모 작성하기"
              onAction={createMemo}
            />
          )
        }
      />
      {selecting ? (
        <View style={[styles.mergeBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.mergeCount, { color: colors.textSecondary }]}>{`${selectedIds.length}개 선택`}</Text>
          <Pressable
            accessibilityRole="button"
            disabled={selectedIds.length < 2}
            onPress={() => router.push({ pathname: '/merge', params: { ids: selectedIds.join(',') } })}
            style={{ opacity: selectedIds.length < 2 ? 0.4 : 1 }}>
            <Text style={[styles.mergeAction, { color: colors.accentText }]}>함께 모아보기</Text>
          </Pressable>
        </View>
      ) : null}
      {sheet}
    </Screen>
  );
}

function openMemo(router: ReturnType<typeof useRouter>, memo: Memo) {
  router.push({ pathname: '/memo/[id]', params: { id: memo.id } });
}

const styles = StyleSheet.create({
  tools: {
    paddingHorizontal: layout.pagePadding,
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  chips: {
    gap: spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingLeft: spacing.sm,
  },
  mergeBar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 88,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mergeCount: {
    fontSize: 14,
    lineHeight: 18,
  },
  mergeAction: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  sortLabel: {
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
    paddingBottom: layout.fabClearance,
  },
  separator: {
    height: spacing.md,
  },
});
