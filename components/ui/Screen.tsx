import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, type Edges } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';

type ScreenProps = {
  children: ReactNode;
  edges?: Edges;
};

export function Screen({ children, edges = ['top'] }: ScreenProps) {
  const { colors } = useTheme();

  return (
    <SafeAreaView edges={edges} style={[styles.screen, { backgroundColor: colors.background }]}>
      {children}
    </SafeAreaView>
  );
}

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  large?: boolean;
};

export function ScreenHeader({ title, subtitle, left, right, large = false }: ScreenHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.header, large ? styles.largeHeader : styles.compactHeader]}>
      {left ? <View style={styles.slot}>{left}</View> : null}
      <View style={styles.titles}>
        <Text
          numberOfLines={1}
          style={[large ? typography.largeTitle : styles.compactTitle, { color: colors.text }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={2} style={[styles.subtitle, { color: colors.textSecondary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.actions}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  largeHeader: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactHeader: {
    minHeight: 56,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  titles: {
    flex: 1,
    justifyContent: 'center',
  },
  compactTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
  },
  subtitle: {
    marginTop: spacing.xs,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
  },
  slot: {
    marginRight: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
});
