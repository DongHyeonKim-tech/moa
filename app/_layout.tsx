import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import 'react-native-reanimated';

import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { userFacingError } from '@/services/dataError';
import { ensureAnonymousSession } from '@/services/session';
import { useMemoStore } from '@/store/memoStore';
import { useSettingsStore } from '@/store/settingsStore';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('기록을 불러오고 있어요.');
  const [attempt, setAttempt] = useState(0);

  const boot = useCallback(() => {
    setPhase('loading');
    let active = true;

    void (async () => {
      try {
        await ensureAnonymousSession();
        await Promise.all([useMemoStore.getState().hydrate(), useSettingsStore.getState().hydrate()]);
        if (active) {
          setPhase('ready');
        }
      } catch (error) {
        if (active) {
          setMessage(userFacingError(error));
          setPhase('error');
        }
      } finally {
        SplashScreen.hideAsync().catch(() => undefined);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => boot(), [attempt, boot]);

  if (phase === 'loading') {
    return null;
  }

  if (phase === 'error') {
    return (
      <ThemeProvider>
        <Screen>
          <EmptyState
            title="기록을 불러오지 못했어요"
            description={message}
            actionLabel="다시 시도"
            onAction={() => setAttempt((current) => current + 1)}
          />
        </Screen>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <RootNavigation />
    </ThemeProvider>
  );
}

function RootNavigation() {
  const { scheme, colors } = useTheme();
  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.accent,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.accent,
      },
    };
  }, [colors, scheme]);

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <SyncBanner />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="memo/[id]" />
        <Stack.Screen name="organize/[id]" />
        <Stack.Screen name="draft" />
        <Stack.Screen name="merge" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="trash" />
      </Stack>
    </NavigationThemeProvider>
  );
}

function SyncBanner() {
  const { colors } = useTheme();
  const syncError = useMemoStore((state) => state.syncError);
  const clearSyncError = useMemoStore((state) => state.clearSyncError);
  if (!syncError) {
    return null;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={clearSyncError}
      style={[styles.banner, { backgroundColor: colors.dangerSoft }]}>
      <Text style={[styles.bannerText, { color: colors.danger }]}>{syncError}</Text>
      <Text style={[styles.bannerAction, { color: colors.danger }]}>닫기</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  bannerAction: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
});
