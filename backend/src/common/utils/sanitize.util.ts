/**
 * Strips HTML tags and angle brackets from a string to neutralize
 * stored/reflected XSS payloads while preserving normal text.
 *
 * @param value - Raw user-supplied string.
 * @returns The sanitized string, trimmed of surrounding whitespace.
 */
export function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .trim();
}

/**
 * Recursively removes MongoDB operator injection vectors from an object:
 * any key beginning with `$` or containing a `.` is dropped.
 *
 * Mutates and returns the same reference so it can be applied to
 * `req.body` / `req.params` in middleware.
 *
 * @param payload - Arbitrary parsed request payload.
 * @returns The same payload with dangerous keys removed.
 */
export function sanitizeMongoPayload<T>(payload: T): T {
  if (Array.isArray(payload)) {
    payload.forEach((item) => sanitizeMongoPayload(item));
    return payload;
  }

  if (payload !== null && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (key.startsWith('$') || key.includes('.')) {
        delete record[key];
      } else {
        sanitizeMongoPayload(record[key]);
      }
    }
  }

  return payload;
}

/**
 * Escapes regex metacharacters so user input can be safely embedded in a
 * MongoDB `$regex` search.
 *
 * @param value - Raw search term.
 * @returns Regex-safe string.
 */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
