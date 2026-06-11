import { format as formatDateFns, isToday, isYesterday, parseISO, subDays } from 'date-fns';
import type { Currency, DateFormat } from '../types/api';

const DATE_FORMAT_PATTERNS: Record<DateFormat, string> = {
  'MM/DD/YYYY': 'MM/dd/yyyy',
  'DD/MM/YYYY': 'dd/MM/yyyy',
  'YYYY-MM-DD': 'yyyy-MM-dd',
};

/**
 * Formats an amount in the given currency using the browser locale.
 *
 * @param amount - Numeric amount.
 * @param currency - ISO currency code; falls back gracefully when unknown.
 */
export function formatCurrency(amount: number, currency: Currency | string = 'USD'): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Formats an ISO date string using the user's preferred date format.
 *
 * @param iso - ISO date string (or null).
 * @param preference - The user's date format setting.
 * @returns Formatted date or an em-dash when absent.
 */
export function formatDate(iso: string | null | undefined, preference: DateFormat): string {
  if (!iso) {
    return '—';
  }
  return formatDateFns(parseISO(iso), DATE_FORMAT_PATTERNS[preference]);
}

/**
 * Formats a timestamp for chat messages (e.g. "2:34 PM" today, otherwise
 * "Mar 5, 2:34 PM").
 */
export function formatMessageTime(iso: string): string {
  const date = parseISO(iso);
  return isToday(date) ? formatDateFns(date, 'p') : formatDateFns(date, 'MMM d, p');
}

/** Sidebar grouping buckets for chat history. */
export type HistoryGroup = 'Today' | 'Yesterday' | 'Last 7 Days' | 'Older';

/**
 * Buckets a timestamp into the sidebar's date groups.
 */
export function groupByRecency(iso: string): HistoryGroup {
  const date = parseISO(iso);
  if (isToday(date)) {
    return 'Today';
  }
  if (isYesterday(date)) {
    return 'Yesterday';
  }
  if (date >= subDays(new Date(), 7)) {
    return 'Last 7 Days';
  }
  return 'Older';
}

/**
 * Formats a month key ("2026-06") as a short label ("Jun 26").
 */
export function formatMonthKey(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return formatDateFns(new Date(year, month - 1, 1), 'MMM yy');
}

/**
 * Formats a millisecond duration as a friendly string ("3.2s").
 */
export function formatDuration(ms: number): string {
  if (ms <= 0) {
    return '—';
  }
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}
