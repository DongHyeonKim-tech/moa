import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import { MemoCard } from '@/components/memo/MemoCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { SearchField } from '@/components/ui/SearchField';
import { useMemoActions } from '@/hooks/useMemoActions';
import { searchMemos } from '@/services/searchService';
import { useMemoStore } from '@/store/memoStore';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, spacing } from '@/theme/tokens';

export default function SearchScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const memos = useMemoStore((state) => state.memos);
  const { open, sheet } = useMemoActions();
  const [query, setQuery] = useState('');
  const inputRef = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(timer);
    }, []),
  );

  const hits = useMemo(() => (query.trim() ? searchMemos(memos, query) : []), [memos, query]);

  return (
    <Screen>
      <ScreenHeader large title="검색" />
      <View style={styles.tools}>
        <SearchField ref={inputRef} value={query} onChangeText={setQuery} autoFocus />
        {query.trim() && hits.length > 0 ? (
          <Text style={[styles.count, { color: colors.textTertiary }]}>{`메모 ${hits.length}개`}</Text>
        ) : null}
      </View>
      <FlatList
        data={hits}
        keyExtractor={(item) => item.memo.id}
        style={styles.fill}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <MemoCard
            memo={item.memo}
            onPress={() => router.push({ pathname: '/memo/[id]', params: { id: item.memo.id } })}
            onLongPress={() => open(item.memo)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          query.trim() ? (
            <EmptyState title="찾고 있는 메모가 없어요." description="다른 단어로 다시 검색해보세요." />
          ) : (
            <EmptyState title="제목, 본문, 태그로 찾아보세요." description="입력하는 즉시 메모를 검색합니다." />
          )
        }
      />
      {sheet}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tools: {
    paddingHorizontal: layout.pagePadding,
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  count: {
    fontSize: 13,
    lineHeight: 18,
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
