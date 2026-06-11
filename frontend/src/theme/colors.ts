import type { InvoiceStatus } from '../types/api';

/**
 * Single source of truth for every color in the app. Tailwind consumes
 * {@link palette} via tailwind.config.ts; non-Tailwind consumers (Recharts,
 * inline SVG) import the semantic exports below. Never hardcode a hex
 * value in a component.
 */
export const palette = {
  navy: {
    50: '#f0f4f8',
    100: '#d9e2ec',
    200: '#bcccdc',
    300: '#9fb3c8',
    400: '#627d98',
    500: '#486581',
    600: '#334e68',
    700: '#1e3a5f',
    800: '#16304f',
    900: '#102a43',
  },
  surface: {
    light: '#f8fafc',
    dark: '#0b1929',
  },
  semantic: {
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
  },
} as const;

/** Colors for chart elements (Recharts can't use Tailwind classes). */
export const chartColors = {
  primary: palette.navy[700],
  secondary: palette.navy[500],
  grid: `${palette.navy[400]}33`,
} as const;

/** Canonical color per invoice status, shared by charts and badges. */
export const statusColors: Record<InvoiceStatus, string> = {
  paid: palette.semantic.success,
  unpaid: palette.semantic.warning,
  overdue: palette.semantic.danger,
};

/** Google's official brand colors, used only for the sign-in button logo. */
export const googleBrandColors = {
  blue: '#4285F4',
  green: '#34A853',
  yellow: '#FBBC05',
  red: '#EA4335',
} as const;
