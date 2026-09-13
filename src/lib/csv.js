// src/lib/csv.js
// ============================================================
// Shared CSV export helpers. Every CSV the app produces should go
// through these so the output is guaranteed to be:
//
//   - Comma-delimited (RFC-4180); never pipes or semicolons.
//   - UTF-8 **with BOM** (\ufeff prefix). Excel on Windows otherwise
//     guesses Windows-1252 and shows mojibake (â€™, Ã±, ...). The
//     BOM forces Excel to decode the file as UTF-8.
//   - Properly quoted: a cell is wrapped in double quotes only when
//     it contains a comma, quote, carriage return or line feed;
//     embedded quotes are escaped by doubling.
//   - Consistent missing values: null/undefined and the "—" / "–"
//     placeholders used by the responses tables are exported as an
//     empty string (no mixing of "—", "No date", "null", blanks).
//   - CRLF line endings (Excel-friendly).
// ============================================================

const normalizeValue = (value) => {
  if (value === null || value === undefined) return '';
  const s = String(value).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (s === '—' || s === '–' || s.trim() === '—') return '';
  return s;
};

export const escapeCsvCell = (value) => {
  const s = normalizeValue(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

/** Builds a complete CSV document (header row + data rows, each an array of raw values) with BOM. */
export const buildCsv = (rows) =>
  '\ufeff' + rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');

/** Prefixes an already-built CSV string with a UTF-8 BOM unless it already has one. */
export const withCsvBom = (csvString) =>
  csvString.startsWith('\ufeff') ? csvString : `\ufeff${csvString}`;