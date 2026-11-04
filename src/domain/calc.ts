/**
 * domain/calc.ts — the pure calculation engine (Build-kit/01 §4, FR-4).
 *
 * Everything is integer halalas / hundredths; rounding is round-half-up applied once,
 * at the print boundary. No `Date.now()`, no `Math.random()`, no float money (FR-8, AC-28).
 */

import { divRoundHalfUp, sumHalalas } from '@/lib/money';
import {
  percentOf,
  percentsSumTo100,
  splitByPercentHundredths,
} from '@/lib/percent';
import type { Commercials, LineItem } from './types';

export type ComputedLine = {
  id: string;
  priceHalalas: number;
};

export type ComputedSplit = {
  label: string;
  percentHundredths: number;
  halalas: number;
};

export type ComputedTotals = {
  lines: ComputedLine[];
  totalHalalas: number;
  discountHalalas: number;
  /** base = total - discount (equals total when discountMode is none). */
  baseHalalas: number;
  vatHalalas: number;
  grandTotalHalalas: number;
  splits: ComputedSplit[];
};

export type CalcInput = {
  lines: readonly LineItem[];
  commercials: Commercials;
};

/** Per-line price: unitPrice x qty (integer hundredths), rounded half-up. Included lines are 0. */
export function computeLinePriceHalalas(line: LineItem): number {
  if (line.pricing === 'included') return 0;
  return divRoundHalfUp(BigInt(line.unitPriceHalalas) * BigInt(line.qtyHundredths), 100n);
}

/** Resolve a discount (amount in halalas, or percent hundredths off the total) to halalas. */
export function discountToHalalas(totalHalalas: number, commercials: Commercials): number {
  const { discountMode, discountValue } = commercials;
  if (discountMode === 'none') return 0;
  if (discountMode === 'amount') {
    return Math.max(0, Math.min(discountValue, totalHalalas));
  }
  // percent: discountValue is integer hundredths of a percent (e.g. 1000 = 10.00%).
  return percentOf(totalHalalas, discountValue);
}

/** VAT on a base at `vatBps` basis points, rounded half-up (FR-4.4). */
export function vatHalalasFor(baseHalalas: number, vatBps: number): number {
  return divRoundHalfUp(BigInt(baseHalalas) * BigInt(vatBps), 10_000n);
}

/**
 * Compute the full totals stack. Advance splits use largest-remainder when they sum to
 * exactly 100% (so printed parts reconstruct the Grand Total), otherwise each is a
 * standalone round-half-up percentage (e.g. a lone 70% Advance row).
 */
export function computeTotals(input: CalcInput): ComputedTotals {
  const { lines, commercials } = input;

  const computedLines: ComputedLine[] = lines.map((line) => ({
    id: line.id,
    priceHalalas: computeLinePriceHalalas(line),
  }));

  const totalHalalas = sumHalalas(computedLines.map((l) => l.priceHalalas));
  const discountHalalas = discountToHalalas(totalHalalas, commercials);
  const baseHalalas = totalHalalas - discountHalalas;
  const vatHalalas = vatHalalasFor(baseHalalas, commercials.vatBps);
  const grandTotalHalalas = baseHalalas + vatHalalas;

  const percents = commercials.advanceSplits.map((s) => s.percentHundredths);
  let parts: number[];
  if (percents.length > 0 && percentsSumTo100(percents)) {
    parts = splitByPercentHundredths(grandTotalHalalas, percents);
  } else {
    parts = percents.map((p) => percentOf(grandTotalHalalas, p));
  }

  const splits: ComputedSplit[] = commercials.advanceSplits.map((s, i) => ({
    label: s.label,
    percentHundredths: s.percentHundredths,
    halalas: parts[i] ?? 0,
  }));

  return {
    lines: computedLines,
    totalHalalas,
    discountHalalas,
    baseHalalas,
    vatHalalas,
    grandTotalHalalas,
    splits,
  };
}
