import { create } from 'zustand';

import { defaultSettings, settingsRepository } from '@/repositories/settingsRepository';
import type { AppSettings, ThemePreference } from '@/types/settings';

type SettingsState = AppSettings & {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setTheme: (theme: ThemePreference) => Promise<void>;
  setAiConsent: (aiConsent: boolean) => Promise<void>;
  setAiProxyUrl: (aiProxyUrl: string) => Promise<void>;
  setAiProxyToken: (aiProxyToken: string) => Promise<void>;
};

let settingsWrite: Promise<void> = Promise.resolve();

function persist(get: () => SettingsState): Promise<void> {
  const { theme, aiConsent, aiProxyUrl, aiProxyToken } = get();
  settingsWrite = settingsWrite.catch(() => undefined).then(() =>
    settingsRepository.save({ theme, aiConsent, aiProxyUrl, aiProxyToken }),
  );
  return settingsWrite;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...defaultSettings,
  hydrated: false,

  async hydrate() {
    if (get().hydrated) {
      return;
    }

    try {
      const settings = await settingsRepository.load();
      set({ ...settings, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  async setTheme(theme) {
    set({ theme });
    await persist(get);
  },

  async setAiConsent(aiConsent) {
    set({ aiConsent });
    await persist(get);
  },

  async setAiProxyUrl(aiProxyUrl) {
    set({ aiProxyUrl });
    await persist(get);
  },

  async setAiProxyToken(aiProxyToken) {
    set({ aiProxyToken });
    await persist(get);
  },
}));
