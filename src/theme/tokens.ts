/**
 * Kun tartibim — dizayn tokenlari
 * -------------------------------
 * MoliyamApp bilan bir oila: monoxrom, dark-first, soyasiz, hairline chegaralar.
 * Rang faqat maʼno tashiganda:
 *   accent (oltin)  — hozirgi namoz, davom etayotgan vaqt
 *   danger (qizil)  — qazo, vaqti tugayotgan namoz (Moliyam'dagi "qarz" rangi)
 */

export const color = {
  bg: '#0A0A0A',
  surface: '#121212',
  surfaceHigh: '#1A1A1A',
  surfacePressed: '#202020',

  border: '#242424',
  borderStrong: '#333333',

  text: '#FAFAFA',
  textMuted: '#8E8E8E',
  textFaint: '#5C5C5C',

  accent: '#E8A33D',
  accentMuted: '#6B4A17',
  accentFaint: '#1F1810',

  danger: '#FF4D2E',
  dangerMuted: '#7A2416',
  dangerFaint: '#2A1310',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  full: 999,
} as const;

export const font = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
} as const;

export const type = {
  display: { fontFamily: font.medium, fontSize: 44, lineHeight: 48, letterSpacing: -1.6 },
  numberLg: { fontFamily: font.medium, fontSize: 26, lineHeight: 30, letterSpacing: -0.6 },
  numberMd: { fontFamily: font.medium, fontSize: 18, lineHeight: 22, letterSpacing: -0.3 },
  title: { fontFamily: font.semibold, fontSize: 20, lineHeight: 25, letterSpacing: -0.4 },
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 21, letterSpacing: -0.1 },
  bodyMedium: { fontFamily: font.medium, fontSize: 15, lineHeight: 21, letterSpacing: -0.1 },
  label: { fontFamily: font.medium, fontSize: 13, lineHeight: 17, letterSpacing: 0 },
  caption: { fontFamily: font.regular, fontSize: 12, lineHeight: 16, letterSpacing: 0.1 },
  overline: {
    fontFamily: font.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
} as const;

export const tabular = { fontVariant: ['tabular-nums' as const] };

export const motion = {
  snappy: { damping: 20, stiffness: 300, mass: 0.6 },
} as const;

export const hairline = 0.5;
