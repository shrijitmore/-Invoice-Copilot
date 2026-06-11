import { Transform } from 'class-transformer';
import { stripHtml } from '../utils/sanitize.util';

/**
 * Property decorator that trims and strips HTML from incoming string
 * values during DTO transformation. Non-string values pass through
 * untouched so type validators can reject them.
 */
export function SanitizedString(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? stripHtml(value) : value,
  );
}
