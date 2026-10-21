import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import type { RelatedSuggestion } from '@/types/ai';
import type { Memo } from '@/types/memo';
import { displayTitle } from '@/utils/memoText';

type RelatedRow = {
  memo: Memo;
  reason?: string;
  actionLabel: string;
  onAction: () => void;
  onOpen: () => void;
};

type RelatedMemosProps = {
  linked: RelatedRow[];
  suggestions: { suggestion: RelatedSuggestion; memo: Memo }[];
  onOpenSuggestion: (memo: Memo) => void;
  onLink: (memoId: string) => void;
  onRefresh: () => void;
};

export function RelatedMemos({ linked, suggestions, onOpenSuggestion, onLink, onRefresh }: RelatedMemosProps) {
  const { colors } = useTheme();
  const visibleSuggestions = suggestions.filter((item) => !linked.some((row) => row.memo.id === item.memo.id));

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textSecondary }]}>비슷한 메모</Text>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onRefresh}>
          <Text style={[styles.refresh, { color: colors.accent }]}>다시 찾기</Text>
        </Pressable>
      </View>
      {linked.length === 0 && visibleSuggestions.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textTertiary }]}>아직 이어진 메모가 없어요.</Text>
      ) : null}
      {linked.map((row) => (
        <Row key={row.memo.id} title={displayTitle(row.memo)} detail="이어진 메모" actionLabel={row.actionLabel} onOpen={row.onOpen} onAction={row.onAction} />
      ))}
      {visibleSuggestions.map(({ suggestion, memo }) => (
        <Row
          key={suggestion.memoId}
          title={displayTitle(memo)}
          detail={suggestion.reason}
          actionLabel="연결"
          onOpen={() => onOpenSuggestion(memo)}
          onAction={() => onLink(memo.id)}
        />
      ))}
    </View>
  );
}

function Row({
  title,
  detail,
  actionLabel,
  onOpen,
  onAction,
}: {
  title: string;
  detail: string;
  actionLabel: string;
  onOpen: () => void;
  onAction: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable accessibilityRole="button" onPress={onOpen} style={styles.copy}>
        <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.text }]}>
          {title}
        </Text>
        <Text numberOfLines={2} style={[styles.detail, { color: colors.textSecondary }]}>
          {detail}
        </Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onAction} hitSlop={6}>
        <Text style={[styles.action, { color: colors.accentText }]}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  refresh: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  empty: {
    fontSize: 14,
    lineHeight: 20,
  },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  detail: {
    fontSize: 13,
    lineHeight: 18,
  },
  action: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
});
