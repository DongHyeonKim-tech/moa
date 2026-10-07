import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppSettings, ThemePreference } from '@/types/settings';

const SETTINGS_STORAGE_KEY = 'moa.settings.v1';

export const defaultSettings: AppSettings = {
  theme: 'system',
};

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function parseSettings(value: unknown): AppSettings {
  if (typeof value !== 'object' || value === null) {
    return defaultSettings;
  }

  const theme = 'theme' in value ? value.theme : undefined;
  return {
    theme: isThemePreference(theme) ? theme : defaultSettings.theme,
  };
}

export const settingsRepository = {
  async load(): Promise<AppSettings> {
    const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return defaultSettings;
    }

    try {
      return parseSettings(JSON.parse(raw) as unknown);
    } catch {
      return defaultSettings;
    }
  },

  async save(settings: AppSettings): Promise<void> {
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  },
};
