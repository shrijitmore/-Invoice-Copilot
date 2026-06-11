import type { Currency, DateFormat, InvoiceStatus } from '../types/api';

/**
 * Frontend application constants. Limits mirror the backend's
 * `app.constants.ts` so client-side validation always matches the API.
 */

/** Maximum invoice document size accepted by the API (10 MB). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Maximum number of files per bulk upload. */
export const MAX_BULK_FILES = 10;

/** MIME types accepted for invoice documents. */
export const ACCEPTED_INVOICE_MIME_TYPES: readonly string[] = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
];

/** Maximum avatar size accepted by the API (2 MB). */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/** MIME types accepted for avatars. */
export const ACCEPTED_AVATAR_MIME_TYPES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
];

/** Maximum chat message length (mirrors the backend DTO). */
export const MAX_CHAT_MESSAGE_LENGTH = 4_000;

/** Supported currencies, in display order. */
export const CURRENCIES: readonly Currency[] = ['USD', 'EUR', 'GBP', 'INR'];

/** Compact currency options for inline selects. */
export const CURRENCY_SELECT_OPTIONS = CURRENCIES.map((code) => ({
  value: code,
  label: code,
}));

/** Descriptive currency options for the settings page. */
export const CURRENCY_LABELED_OPTIONS: ReadonlyArray<{ value: Currency; label: string }> = [
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'GBP', label: 'British Pound (GBP)' },
  { value: 'INR', label: 'Indian Rupee (INR)' },
];

/** Date format options for the settings page. */
export const DATE_FORMAT_OPTIONS: ReadonlyArray<{ value: DateFormat; label: string }> = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (06/15/2026)' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (15/06/2026)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2026-06-15)' },
];

/** Human-readable label per invoice status. */
export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  paid: 'Paid',
  unpaid: 'Unpaid',
  overdue: 'Overdue',
};
