import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';

type SectionHeaderProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  trailing?: ReactNode;
};

export function SectionHeader({ title, description, actionLabel, onAction, trailing }: SectionHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.textSecondary }]}>{title}</Text>
        {description ? <Text style={[styles.description, { color: colors.textTertiary }]}>{description}</Text> : null}
      </View>
      {trailing}
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onAction}>
          <Text style={[styles.action, { color: colors.accent }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.section,
  },
  description: {
    ...typography.caption,
  },
  action: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
});
