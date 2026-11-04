/**
 * dates.ts — explicit ISO ↔ ordinal-date formatting. No `Intl`, no `Date.now()`,
 * no locale surprises (Build-kit/02 §3 rule 7). Dates come only from explicit fields.
 */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month1: number): number {
  if (month1 === 2 && isLeapYear(year)) return 29;
  return DAYS_IN_MONTH[month1 - 1]!;
}

/** Parse `yyyy-mm-dd` into numeric parts; null on malformed or out-of-range input. */
export function parseIsoDateParts(iso: string): { year: number; month: number; day: number } | null {
  const m = ISO_DATE.exec(iso);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/** English ordinal suffix for a 1-based day-of-month (1→st, 2→nd, 3→rd, 11→th, 21→st…). */
export function ordinalSuffix(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

/** Format `yyyy-mm-dd` as `17th October 2026`. Throws on invalid ISO input. */
export function formatOrdinalDate(iso: string): string {
  const parts = parseIsoDateParts(iso);
  if (!parts) throw new RangeError(`dates: invalid ISO date "${iso}"`);
  const { year, month, day } = parts;
  return `${day}${ordinalSuffix(day)} ${MONTH_NAMES[month - 1]} ${year}`;
}

/** Format `yyyy-mm-dd` as `16th November, 2026` (comma before the year, per reference). */
export function formatOrdinalDateComma(iso: string): string {
  const parts = parseIsoDateParts(iso);
  if (!parts) throw new RangeError(`dates: invalid ISO date "${iso}"`);
  const { year, month, day } = parts;
  return `${day}${ordinalSuffix(day)} ${MONTH_NAMES[month - 1]}, ${year}`;
}
