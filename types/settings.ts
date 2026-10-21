export type ThemePreference = 'system' | 'light' | 'dark';

export type AppSettings = {
  theme: ThemePreference;
  aiConsent: boolean;
  aiProxyUrl: string;
  aiProxyToken: string;
};
