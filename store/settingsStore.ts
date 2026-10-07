import { create } from 'zustand';

import { defaultSettings, settingsRepository } from '@/repositories/settingsRepository';
import type { ThemePreference } from '@/types/settings';

type SettingsState = {
  theme: ThemePreference;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setTheme: (theme: ThemePreference) => Promise<void>;
};

let settingsWrite: Promise<void> = Promise.resolve();

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: defaultSettings.theme,
  hydrated: false,

  async hydrate() {
    if (get().hydrated) {
      return;
    }

    try {
      const settings = await settingsRepository.load();
      set({ theme: settings.theme, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  async setTheme(theme) {
    set({ theme });
    settingsWrite = settingsWrite.catch(() => undefined).then(() => settingsRepository.save({ theme: get().theme }));
    await settingsWrite;
  },
}));
