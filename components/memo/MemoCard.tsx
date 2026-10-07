import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import type { Memo } from '@/types/memo';
import { formatRelativeTime } from '@/utils/date';
import { displayPreview, displayTitle } from '@/utils/memoText';

type MemoCardProps = {
  memo: Memo;
  onPress: () => void;
  onLongPress?: () => void;
  eyebrow?: string;
};

export function MemoCard({ memo, onPress, onLongPress, eyebrow }: MemoCardProps) {
  const { colors } = useTheme();
  const preview = displayPreview(memo);
  const tags = memo.tags.slice(0, 3);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
          borderColor: colors.border,
        },
      ]}>
      {eyebrow ? <Text style={[styles.eyebrow, { color: colors.accentText }]}>{eyebrow}</Text> : null}
      <View style={styles.titleRow}>
        <Text numberOfLines={2} style={[styles.title, { color: colors.text }]}>
          {displayTitle(memo)}
        </Text>
        <View style={styles.badges}>
          {memo.isPinned ? <Icon name="pinFill" color={colors.accent} size={15} /> : null}
          {memo.isFavorite ? <Icon name="starFill" color={colors.favorite} size={15} /> : null}
        </View>
      </View>
      {preview ? (
        <Text numberOfLines={3} style={[styles.preview, { color: colors.textSecondary }]}>
          {preview}
        </Text>
      ) : null}
      <View style={styles.meta}>
        {tags.length > 0 ? (
          <Text numberOfLines={1} style={[styles.tags, { color: colors.accentText }]}>
            {tags.map((tag) => `#${tag}`).join('  ')}
          </Text>
        ) : (
          <View style={styles.tags} />
        )}
        <Text style={[styles.date, { color: colors.textTertiary }]}>{formatRelativeTime(memo.updatedAt)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  eyebrow: {
    ...typography.caption,
    fontWeight: '600',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  title: {
    ...typography.cardTitle,
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 22,
  },
  preview: {
    ...typography.preview,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  tags: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  date: {
    fontSize: 12,
    lineHeight: 16,
  },
});
