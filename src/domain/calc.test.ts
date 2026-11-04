import { describe, it, expect } from 'vitest';
import { computeTotals, computeLinePriceHalalas, vatHalalasFor } from './calc';
import { formatSar } from '@/lib/money';
import type { Commercials, LineItem } from './types';

function line(id: string, unitPriceHalalas: number, qtyHundredths: number, pricing: 'rated' | 'included' = 'rated'): LineItem {
  return { id, description: 'x', uom: 'u', qtyHundredths, unitPriceHalalas, pricing };
}
function comm(over: Partial<Commercials> = {}): Commercials {
  return {
    discountMode: 'none',
    discountValue: 0,
    vatBps: 1500,
    paymentTermsText: [],
    advanceSplits: [],
    ...over,
  };
}

describe('calc oracle (02 §4 / AC-1)', () => {
  it('Q-6824 single line', () => {
    const t = computeTotals({ lines: [line('1', 530000, 100)], commercials: comm() });
    expect(t.totalHalalas).toBe(530000);
    expect(t.vatHalalas).toBe(79500);
    expect(t.grandTotalHalalas).toBe(609500);
    expect(formatSar(t.totalHalalas)).toBe('5,300.00');
    expect(formatSar(t.vatHalalas)).toBe('795.00');
    expect(formatSar(t.grandTotalHalalas)).toBe('6,095.00');
  });

  it('Q-6879 multi line', () => {
    const t = computeTotals({
      lines: [line('a', 1950000, 100), line('b', 110000, 5000)],
      commercials: comm(),
    });
    expect(formatSar(t.totalHalalas)).toBe('74,500.00');
    expect(formatSar(t.vatHalalas)).toBe('11,175.00');
    expect(formatSar(t.grandTotalHalalas)).toBe('85,675.00');
  });

  it('PF-5799 base + VAT + 70% advance', () => {
    const t = computeTotals({
      lines: [line('x', 5553000, 100)],
      commercials: comm({ advanceSplits: [{ label: '70% Advance', percentHundredths: 7000 }] }),
    });
    expect(formatSar(t.baseHalalas)).toBe('55,530.00');
    expect(formatSar(t.vatHalalas)).toBe('8,329.50');
    expect(formatSar(t.grandTotalHalalas)).toBe('63,859.50');
    expect(t.splits[0]?.halalas).toBe(4470165);
    expect(formatSar(t.splits[0]!.halalas)).toBe('44,701.65');
  });
});

describe('calc edge cases', () => {
  it('EC-1 fractional qty rounds half-up', () => {
    expect(computeLinePriceHalalas(line('1', 19999, 50))).toBe(10000); // 0.5 x 199.99 -> 100.00
  });
  it('EC-2 rounding trap 1.005 -> 1.01', () => {
    const t = computeTotals({ lines: [line('1', 101, 100)], commercials: comm({ vatBps: 0 }) });
    expect(formatSar(t.totalHalalas)).toBe('1.01');
  });
  it('included lines contribute 0 (HP-3 bundled)', () => {
    expect(computeLinePriceHalalas(line('1', 500000, 100, 'included'))).toBe(0);
  });
  it('percent discount reduces the base', () => {
    const t = computeTotals({
      lines: [line('1', 100000, 100)], // 1,000.00
      commercials: comm({ discountMode: 'percent', discountValue: 1000 }), // 10%
    });
    expect(formatSar(t.discountHalalas)).toBe('100.00');
    expect(formatSar(t.baseHalalas)).toBe('900.00');
    expect(formatSar(t.vatHalalas)).toBe('135.00');
  });
  it('amount discount clamps to the total', () => {
    const t = computeTotals({
      lines: [line('1', 5000, 100)], // 50.00
      commercials: comm({ discountMode: 'amount', discountValue: 999999 }),
    });
    expect(t.baseHalalas).toBe(0);
  });
  it('EC-10 VAT rate honoured when changed to 5%', () => {
    expect(vatHalalasFor(100000, 500)).toBe(5000); // 5% of 1,000.00 = 50.00
  });
  it('AC-3 three-way split reconstructs the grand total', () => {
    const t = computeTotals({
      lines: [line('1', 100000, 100)], // 1,000.00, no VAT
      commercials: comm({
        vatBps: 0,
        advanceSplits: [
          { label: '33%', percentHundredths: 3333 },
          { label: '33%', percentHundredths: 3333 },
          { label: '34%', percentHundredths: 3334 },
        ],
      }),
    });
    const sum = t.splits.reduce((a, s) => a + s.halalas, 0);
    expect(sum).toBe(t.grandTotalHalalas);
  });
  it('determinism: same input twice is deep-equal', () => {
    const input = { lines: [line('a', 111111, 333), line('b', 222, 4000)], commercials: comm() };
    expect(computeTotals(input)).toEqual(computeTotals(input));
  });
});
