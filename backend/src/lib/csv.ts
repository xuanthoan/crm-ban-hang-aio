/**
 * CSV helpers — Sprint Import/Export (MVP: CSV UTF-8 only).
 *
 * Pure module (no Prisma, no Express): parse and stringify can be
 * unit-tested without a database.
 *
 * Parser rules (RFC 4180 subset, the subset Excel actually produces):
 *  - Comma delimiter, first row is the header.
 *  - A field may be wrapped in double quotes; inside a quoted field a
 *    comma, a line break and a doubled double-quote ("") are literal.
 *  - A leading UTF-8 BOM is stripped. CRLF and LF line endings both work.
 *  - An unbalanced quote is an error, not silently repaired.
 *
 * Stringifier rules:
 *  - A field containing a comma, quote, CR or LF is wrapped in double
 *    quotes and inner quotes are doubled.
 *  - CSV-injection guard (locked rules §6: export must not become a
 *    code-execution vector in a spreadsheet): after trimming leading
 *    whitespace, a cell starting with =, +, -, @, tab or CR/LF is
 *    prefixed with a single quote (') so Excel/Sheets treat it as text.
 *    The guard is applied on EXPORT only; imported values are stored
 *    verbatim (minus surrounding whitespace) so a round-trip does not
 *    accumulate quotes.
 */

/** One parsed CSV document: header row + data rows as string maps. */
export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export class CsvError extends Error {}

/** Strip a UTF-8 BOM (U+FEFF) if present. */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Parse CSV text into headers + rows. Empty trailing lines are ignored;
 * a fully-empty data row is skipped (so a trailing newline is not a row).
 * Throws CsvError on an unbalanced quote.
 */
export function parseCsv(text: string): ParsedCsv {
  const src = stripBom(text);
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
      continue;
    }
    if (ch === '"') {
      // A quote is only special at the start of a field; mid-field
      // quotes are kept verbatim so malformed input stays visible.
      if (field.length === 0) {
        inQuotes = true;
        i += 1;
      } else {
        field += ch;
        i += 1;
      }
      continue;
    }
    if (ch === ",") {
      record.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      if (src[i + 1] === "\n") i += 1;
      record.push(field);
      field = "";
      records.push(record);
      record = [];
      i += 1;
      continue;
    }
    if (ch === "\n") {
      record.push(field);
      field = "";
      records.push(record);
      record = [];
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (inQuotes) throw new CsvError("File CSV không hợp lệ: dấu ngoặc kép không được đóng.");
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  const nonEmpty = records.filter((r) => !(r.length === 1 && r[0].trim() === ""));
  if (nonEmpty.length === 0) throw new CsvError("File CSV trống (không có dòng header).");
  const headers = nonEmpty[0].map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let r = 1; r < nonEmpty.length; r += 1) {
    const rec = nonEmpty[r];
    if (rec.length === 1 && rec[0].trim() === "") continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (rec[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return { headers, rows };
}

/** CSV-injection guard for one exported cell. */
export function safeCsvCell(value: string): string {
  const trimmed = value.replace(/^\s+/, "");
  if (/^[=+\-@\t\r\n]/.test(trimmed)) return `'${value}`;
  return value;
}

/** Escape one cell for output (quoting + injection guard). */
export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const raw = safeCsvCell(String(value));
  if (/[",\r\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

/** Render a header + rows as CSV text (no BOM here; the route adds one). */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(escapeCsvCell).join(",")];
  for (const row of rows) lines.push(row.map(escapeCsvCell).join(","));
  return `${lines.join("\r\n")}\r\n`;
}

/** Split a multi-value cell on ';' or '|' (phones, tags). Empty parts dropped. */
export function splitListCell(value: string | undefined | null): string[] {
  if (!value) return [];
  return value
    .split(/[;|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Parse a money/price cell: empty -> null (caller decides the default),
 * otherwise a finite number. Commas are NOT thousand separators here
 * (comma is the CSV delimiter); "1.5" and "1500" are valid, "1,500" is
 * not — it would have been split into two CSV fields already.
 */
export function parsePriceCell(value: string | undefined | null): { value: number | null; error?: string } {
  if (value === undefined || value === null || value.trim() === "") return { value: null };
  const n = Number(value.trim());
  if (!Number.isFinite(n)) return { value: null, error: `Giá trị "${value}" không phải là số.` };
  return { value: n };
}

/** Parse an attributes cell: "color:Đen;size:S" -> [{name:"color",value:"Đen"},...]. */
export function parseAttributesCell(value: string | undefined | null): {
  attributes: { name: string; value: string }[];
  error?: string;
} {
  if (!value || !value.trim()) return { attributes: [] };
  const out: { name: string; value: string }[] = [];
  for (const part of splitListCell(value)) {
    const idx = part.indexOf(":");
    if (idx <= 0 || idx === part.length - 1) {
      return { attributes: [], error: `Thuộc tính "${part}" phải có dạng tên:giá trị (ví dụ color:Đen).` };
    }
    out.push({ name: part.slice(0, idx).trim(), value: part.slice(idx + 1).trim() });
  }
  if (out.length > 3) return { attributes: [], error: "Tối đa 3 thuộc tính cho một biến thể." };
  const names = new Set(out.map((a) => a.name.toLowerCase()));
  if (names.size !== out.length) return { attributes: [], error: "Tên thuộc tính bị trùng trong cùng một biến thể." };
  return { attributes: out };
}

/** Format a Decimal-like value (Prisma Decimal or number) as a plain string. */
export function decimalToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(value);
  return String(value);
}

/** ISO date (YYYY-MM-DD) from a Date, for export columns. */
export function isoDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}
