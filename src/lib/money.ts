/**
 * money.ts — integer-halalas arithmetic and string-exact formatting.
 *
 * Determinism contract (Build-kit/02 §3):
 *  - All money is stored/computed as INTEGER halalas (1 SAR = 100 halalas).
 *  - No float ever appears in the money path. Multiplication/division uses BigInt,
 *    rounding is round-half-up applied once, at the display/print boundary.
 *  - Formatting uses integer string manipulation, never `toLocaleString`.
 */

/** A finite integer safe for our arithmetic. */
function assertSafeHalalas(halalas: number): void {
  if (!Number.isSafeInteger(halalas)) {
    throw new RangeError(`money: expected safe-integer halalas, got ${halalas}`);
  }
}

/**
 * Round a non-negative rational `num / den` HALF-UP to the nearest integer.
 * Exact via BigInt: floor((2·num + den) / (2·den)).
 */
export function divRoundHalfUp(num: bigint, den: bigint): number {
  if (den <= 0n) throw new RangeError('money: divRoundHalfUp requires den > 0');
  if (num < 0n) {
    // Half-up on the magnitude, then re-apply sign (matches financial rounding of |value|).
    return -Number(((-num) * 2n + den) / (2n * den));
  }
  return Number((num * 2n + den) / (2n * den));
}

/**
 * Parse a human SAR amount into integer halalas using STRING parsing (no float).
 * Accepts optional sign, thousands separators (commas) and spaces.
 * Rounds any sub-halala remainder HALF-UP (e.g. "1.005" → 101 halalas = 1.01).
 * Returns null for malformed input.
 */
export function parseDecimalToHalalas(raw: string): number | null {
  const cleaned = raw.replace(/[,\s]/g, '');
  if (cleaned === '') return null;
  const m = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(cleaned);
  if (!m) return null;
  const [, sign, intPartRaw, fracPartRaw] = m;
  const intPart = intPartRaw ?? '';
  const fracPart = fracPartRaw ?? '';
  if (intPart === '' && fracPart === '') return null; // no digits at all (e.g. ".", "-")

  const centsDigits = fracPart.slice(0, 2).padEnd(2, '0'); // first 2 dp → halalas
  const remainderDigits = fracPart.slice(2); // sub-halala remainder
  const base = BigInt(intPart === '' ? '0' : intPart) * 100n + BigInt(centsDigits);
  // Half-up: the first dropped digit decides (>=5 rounds up regardless of what follows).
  const roundUp = remainderDigits.length > 0 && remainderDigits.charCodeAt(0) >= 53; // '5'
  const unsigned = base + (roundUp ? 1n : 0n);
  const value = sign === '-' ? -unsigned : unsigned;
  const asNumber = Number(value);
  if (!Number.isSafeInteger(asNumber)) return null;
  return asNumber;
}

/** Parse and throw on failure — for use at typed boundaries after Zod validation. */
export function parseDecimalToHalalasOrThrow(raw: string): number {
  const h = parseDecimalToHalalas(raw);
  if (h === null) throw new RangeError(`money: cannot parse amount "${raw}"`);
  return h;
}

/**
 * Format integer halalas as a grouped, 2-decimal SAR string: 530000 → "5,300.00".
 * Never scientific notation; never float drift.
 */
export function formatSar(halalas: number): string {
  assertSafeHalalas(halalas);
  const negative = halalas < 0;
  const abs = Math.abs(halalas);
  const whole = Math.trunc(abs / 100);
  const cents = abs % 100;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}.${String(cents).padStart(2, '0')}`;
}

/** Format with the literal currency prefix used in PDF money cells: "SAR 5,300.00". */
export function formatSarPrefixed(halalas: number): string {
  return `SAR ${formatSar(halalas)}`;
}

/** Exact halalas sum of non-negative integer halalas values (integers only, no drift). */
export function sumHalalas(values: readonly number[]): number {
  let total = 0;
  for (const v of values) {
    assertSafeHalalas(v);
    total += v;
    if (!Number.isSafeInteger(total)) throw new RangeError('money: sum overflow safe-integer range');
  }
  return total;
}
