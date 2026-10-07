export type ColorTokens = {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  onAccent: string;
  danger: string;
  dangerSoft: string;
  favorite: string;
  overlay: string;
  tabBar: string;
};

export const palette: Record<'light' | 'dark', ColorTokens> = {
  light: {
    background: '#F6F5F2',
    surface: '#FFFFFF',
    surfaceMuted: '#EEEEEA',
    text: '#1C1B19',
    textSecondary: '#6F6B64',
    textTertiary: '#9C978F',
    border: '#E5E2DB',
    accent: '#2C6E5A',
    accentSoft: '#E6F3EE',
    accentText: '#1F5344',
    onAccent: '#FFFFFF',
    danger: '#A33B32',
    dangerSoft: '#F8ECEA',
    favorite: '#B8862F',
    overlay: 'rgba(28, 27, 25, 0.45)',
    tabBar: '#F6F5F2',
  },
  dark: {
    background: '#111110',
    surface: '#1C1C1A',
    surfaceMuted: '#262623',
    text: '#F3F1EC',
    textSecondary: '#B7B2A8',
    textTertiary: '#8C877E',
    border: '#2F2F2C',
    accent: '#9ED4C2',
    accentSoft: '#1A2C26',
    accentText: '#C9EBDF',
    onAccent: '#10241C',
    danger: '#F0B2AB',
    dangerSoft: '#3A2422',
    favorite: '#E2B15A',
    overlay: 'rgba(0, 0, 0, 0.62)',
    tabBar: '#111110',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const typography = {
  largeTitle: { fontSize: 32, lineHeight: 38, fontWeight: '700' as const },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  cardTitle: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  preview: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  section: { fontSize: 13, lineHeight: 18, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  micro: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
} as const;

export const layout = {
  pagePadding: 20,
  cardGap: 12,
  fabSize: 56,
  fabClearance: 108,
} as const;
