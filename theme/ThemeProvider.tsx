import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { palette, type ColorTokens } from '@/theme/tokens';
import { useSettingsStore } from '@/store/settingsStore';
import type { ThemePreference } from '@/types/settings';

type ThemeContextValue = {
  scheme: 'light' | 'dark';
  colors: ColorTokens;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function useResolvedScheme(): 'light' | 'dark' {
  const nativeScheme = useColorScheme();
  const preference = useSettingsStore((state) => state.theme);
  const [webScheme, setWebScheme] = useState<'light' | 'dark' | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => setWebScheme(media.matches ? 'dark' : 'light');
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  const systemScheme = Platform.OS === 'web' ? (webScheme ?? 'light') : nativeScheme;
  return preference === 'system' ? systemScheme : preference;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useResolvedScheme();
  const preference = useSettingsStore((state) => state.theme);
  const setPreference = useSettingsStore((state) => state.setTheme);

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme,
      colors: palette[scheme],
      preference,
      setPreference,
    }),
    [preference, scheme, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useTheme는 ThemeProvider 안에서만 사용할 수 있습니다.');
  }
  return value;
}
