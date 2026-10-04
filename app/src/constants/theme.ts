/** LANDRUSH design tokens (dark theme only, matches the mockup). */
export const C = {
  bg: '#070D0B',
  bgElevated: '#0D1512',
  card: '#111A16',
  cardBorder: '#1C2823',
  cardPressed: '#16211C',
  divider: '#1A2520',
  text: '#FFFFFF',
  textSecondary: '#A3ADA8',
  textMuted: '#6E7974',
  green: '#3FD958',
  greenDark: '#22A93C',
  greenSoft: '#123A1E',
  greenBorder: '#2B7A3B',
  coin: '#F6B728',
  coinDark: '#C98612',
  gem: '#B464F5',
  danger: '#EF4444',
  gold: '#E7B33C',
  silver: '#9AA4AE',
  bronze: '#B3703A',
} as const;

export const RARITY_COLORS = {
  common: { bg: '#3A403E', text: '#D5DBD8', map: '#9CA3AF' },
  uncommon: { bg: '#1C6B2C', text: '#D9FBE0', map: '#3FD958' },
  rare: { bg: '#2563EB', text: '#FFFFFF', map: '#3B82F6' },
  epic: { bg: '#7C3AED', text: '#FFFFFF', map: '#A855F7' },
  legendary: { bg: '#D97706', text: '#FFFFFF', map: '#F59E0B' },
} as const;

export const S = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const R = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const TAB_BAR_HEIGHT = 70;
