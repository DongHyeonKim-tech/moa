import { Link, Stack } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function NotFoundScreen() {
  const { colors } = useTheme();

  return (
    <>
      <Stack.Screen options={{ title: '찾을 수 없음', headerShown: false }} />
      <Screen edges={['top', 'bottom']}>
        <Text style={[styles.title, { color: colors.text }]}>화면을 찾을 수 없어요.</Text>
        <Link href="/" style={styles.link}>
          <Text style={[styles.linkText, { color: colors.accent }]}>홈으로 돌아가기</Text>
        </Link>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
  },
  link: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  linkText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
});
