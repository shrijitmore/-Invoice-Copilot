/** Cookie name carrying the short-lived JWT access token. */
export const ACCESS_TOKEN_COOKIE = 'access_token';

/** Cookie name carrying the long-lived refresh token. */
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

/** Header used to propagate a unique id for request tracing. */
export const REQUEST_ID_HEADER = 'x-request-id';

/** Maximum accepted upload size for invoice documents (10 MB). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Maximum accepted avatar size (2 MB). */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/** Maximum number of files accepted in a single bulk upload. */
export const MAX_BULK_FILES = 10;

/** MIME types accepted for invoice document uploads. */
export const ALLOWED_INVOICE_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

/** MIME types accepted for avatar uploads. */
export const ALLOWED_AVATAR_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** Upper bound for free-form text fields (notes, pasted invoice text). */
export const MAX_TEXT_LENGTH = 20_000;

/** Upper bound for short text fields (names, vendor, invoice number). */
export const MAX_SHORT_TEXT_LENGTH = 200;

/** Upper bound for a single chat message. */
export const MAX_CHAT_MESSAGE_LENGTH = 4_000;

/** Number of past messages replayed to the model for conversational memory. */
export const CHAT_HISTORY_WINDOW = 40;

/** Days before a due date at which a "due soon" notification fires. */
export const DUE_SOON_DAYS = 3;

/** Supported user-facing currencies. */
export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/** Supported date display formats. */
export const SUPPORTED_DATE_FORMATS = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'] as const;
export type SupportedDateFormat = (typeof SUPPORTED_DATE_FORMATS)[number];
