/**
 * Minimal, dependency-free CSV serialization (RFC 4180 compliant).
 */

/**
 * Escapes a single CSV cell: wraps in quotes when it contains commas,
 * quotes or newlines, doubling embedded quotes. Values beginning with
 * formula characters are prefixed to defuse CSV injection in spreadsheets.
 *
 * @param value - Cell content.
 * @returns Escaped cell ready for inclusion in a CSV row.
 */
export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\n\r]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Serializes rows into a CSV document with a header line.
 *
 * @param headers - Ordered column headers.
 * @param rows - Row data; each row must align with the headers.
 * @returns Complete CSV document as a string.
 */
export function toCsv(
  headers: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>,
): string {
  const lines = [headers.map(escapeCsvCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(','));
  }
  return lines.join('\r\n');
}
