/**
 * percent.ts — integer-hundredths percent parsing and largest-remainder (Hamilton) splits.
 *
 * Mirror of the reference `salary-breakdown.ts` discipline: percents are integer
 * hundredths (60.01% → 6001) and split parts are allocated so they sum EXACTLY to the
 * whole (Build-kit/02 §3 rule 5, AC-3). No float in the allocation path.
 */

import { divRoundHalfUp } from './money';

const HUNDREDTH_PCT_SCALE = 10_000; // 100.00% in integer hundredths

/** Parse a percent string ("70", "70.00", "33.34") to integer hundredths; null if invalid/>100%. */
export function parsePercentHundredths(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, frac = ''] = trimmed.split('.');
  const fracPadded = (frac + '00').slice(0, 2);
  const hundredths = Number(whole) * 100 + Number(fracPadded);
  if (!Number.isSafeInteger(hundredths) || hundredths < 0 || hundredths > HUNDREDTH_PCT_SCALE) {
    return null;
  }
  return hundredths;
}

/** Sum a set of integer-hundredths percents; null if any entry is out of range. */
export function sumPercentHundredths(values: readonly number[]): number | null {
  let sum = 0;
  for (const v of values) {
    if (!Number.isSafeInteger(v) || v < 0 || v > HUNDREDTH_PCT_SCALE) return null;
    sum += v;
  }
  return sum;
}

/** True when the percents sum to exactly 100.00% (10000 hundredths). */
export function percentsSumTo100(values: readonly number[]): boolean {
  return sumPercentHundredths(values) === HUNDREDTH_PCT_SCALE;
}

/**
 * Split `totalUnits` (e.g. halalas) across `percentHundredths` via largest-remainder.
 * Requires the percents to sum to exactly 100.00%. Guarantees Σ(parts) === totalUnits.
 * Returns [] for invalid input (mismatched sum, negatives, empty).
 */
export function splitByPercentHundredths(
  totalUnits: number,
  percentHundredths: readonly number[],
): number[] {
  if (!Number.isSafeInteger(totalUnits) || totalUnits < 0) return [];
  if (percentHundredths.length === 0) return [];
  if (!percentsSumTo100(percentHundredths)) return [];

  const T = BigInt(totalUnits);
  const floors: number[] = [];
  const remainders: { index: number; rem: bigint }[] = [];
  let allocated = 0;

  for (let i = 0; i < percentHundredths.length; i++) {
    const p = percentHundredths[i]!;
    const num = T * BigInt(p);
    const floor = num / 10000n;
    const rem = num % 10000n;
    floors.push(Number(floor));
    allocated += Number(floor);
    remainders.push({ index: i, rem });
  }

  const deficit = totalUnits - allocated; // 0 <= deficit < parts count
  // Deterministic ordering: remainder desc, then original index asc on ties.
  remainders.sort((a, b) => {
    if (a.rem !== b.rem) return a.rem > b.rem ? -1 : 1;
    return a.index - b.index;
  });
  for (let k = 0; k < deficit; k++) {
    const target = remainders[k]!;
    floors[target.index] = (floors[target.index] ?? 0) + 1;
  }
  return floors;
}

/**
 * One-off percentage of a total (e.g. a lone "70% Advance" row) via round-half-up.
 * Use {@link splitByPercentHundredths} when the parts must together reconstruct a whole.
 */
export function percentOf(totalUnits: number, percentHundredths: number): number {
  if (!Number.isSafeInteger(totalUnits)) throw new RangeError('percent: totalUnits must be integer');
  if (!Number.isSafeInteger(percentHundredths) || percentHundredths < 0 || percentHundredths > HUNDREDTH_PCT_SCALE) {
    throw new RangeError('percent: percentHundredths out of range');
  }
  return divRoundHalfUp(BigInt(totalUnits) * BigInt(percentHundredths), 10_000n);
}
