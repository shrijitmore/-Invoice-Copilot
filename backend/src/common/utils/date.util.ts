/**
 * Date helpers used by analytics and overdue detection. All computations are
 * UTC-based for consistency across server regions.
 */

/** Returns the first millisecond of the month containing `date` (UTC). */
export function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/** Returns the first millisecond of the month `offset` months after `date`. */
export function addMonths(date: Date, offset: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
}

/** Returns a date `days` days after `date`. */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** Returns midnight UTC of the given date. */
export function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Whole days between two dates, truncated toward zero. */
export function daysBetween(from: Date, to: Date): number {
  return Math.trunc((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);
}

/** `YYYY-MM` label for a date, used as a grouping key in trends. */
export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
