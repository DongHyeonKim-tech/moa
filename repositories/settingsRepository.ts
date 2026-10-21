import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppSettings, ThemePreference } from '@/types/settings';

const SETTINGS_STORAGE_KEY = 'moa.settings.v1';

export const defaultAiProxyUrl = process.env.EXPO_PUBLIC_AI_PROXY_URL ?? 'http://127.0.0.1:8787';

export const defaultSettings: AppSettings = {
  theme: 'system',
  aiConsent: false,
  aiProxyUrl: defaultAiProxyUrl,
  aiProxyToken: '',
};

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function parseSettings(value: unknown): AppSettings {
  if (typeof value !== 'object' || value === null) {
    return defaultSettings;
  }

  const theme = 'theme' in value ? value.theme : undefined;
  const aiProxyUrl = 'aiProxyUrl' in value && typeof value.aiProxyUrl === 'string' ? value.aiProxyUrl : defaultSettings.aiProxyUrl;
  const aiProxyToken = 'aiProxyToken' in value && typeof value.aiProxyToken === 'string' ? value.aiProxyToken : '';
  return {
    theme: isThemePreference(theme) ? theme : defaultSettings.theme,
    aiConsent: 'aiConsent' in value && value.aiConsent === true,
    aiProxyUrl: aiProxyUrl.trim() || defaultSettings.aiProxyUrl,
    aiProxyToken,
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
