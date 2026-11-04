import { describe, it, expect } from 'vitest';
import {
  parseDecimalToHalalas,
  formatSar,
  sumHalalas,
  divRoundHalfUp,
} from './money';

describe('parseDecimalToHalalas (string-exact, no float)', () => {
  it('parses whole and 2dp amounts', () => {
    expect(parseDecimalToHalalas('5300')).toBe(530000);
    expect(parseDecimalToHalalas('1,234.56')).toBe(123456);
    expect(parseDecimalToHalalas('19,500.00')).toBe(1950000);
    expect(parseDecimalToHalalas(' 74500 ')).toBe(7450000);
  });

  it('rounds sub-halala remainders HALF-UP (EC-2, AC-2)', () => {
    expect(parseDecimalToHalalas('1.005')).toBe(101); // never 100
    expect(parseDecimalToHalalas('1.004')).toBe(100);
    expect(parseDecimalToHalalas('19999.999')).toBe(2000000); // -> 20,000.00
    expect(parseDecimalToHalalas('199.99')).toBe(19999);
  });

  it('handles tenths and negatives; rejects garbage', () => {
    expect(parseDecimalToHalalas('0.1')).toBe(10);
    expect(parseDecimalToHalalas('-12.34')).toBe(-1234);
    expect(parseDecimalToHalalas('')).toBeNull();
    expect(parseDecimalToHalalas('1.2.3')).toBeNull();
    expect(parseDecimalToHalalas('abc')).toBeNull();
  });
});

describe('divRoundHalfUp (BigInt exact)', () => {
  it('rounds half up on the boundary', () => {
    expect(divRoundHalfUp(1n, 2n)).toBe(1); // 0.5 -> 1
    expect(divRoundHalfUp(3n, 2n)).toBe(2); // 1.5 -> 2
    expect(divRoundHalfUp(999950n, 100n)).toBe(10000); // 9999.5 -> 10000 (EC-1)
    expect(divRoundHalfUp(4n, 2n)).toBe(2);
    expect(divRoundHalfUp(1n, 3n)).toBe(0);
  });
});

describe('formatSar (AC-4)', () => {
  it('matches the grouping regex at/above 1000 and plain below', () => {
    const atLeast1000 = /^\d{1,3}(,\d{3})*\.\d{2}$/;
    const below = /^\d+\.\d{2}$/;
    expect(formatSar(7450000)).toBe('74,500.00');
    expect(formatSar(7450000)).toMatch(atLeast1000);
    expect(formatSar(8567500)).toBe('85,675.00');
    expect(formatSar(123456)).toBe('1,234.56');
    expect(formatSar(999)).toBe('9.99');
    expect(formatSar(999)).toMatch(below);
    expect(formatSar(30)).toBe('0.30');
    expect(formatSar(-1234)).toBe('-12.34');
  });

  it('never emits scientific notation or float drift', () => {
    expect(formatSar(1000000000000)).toBe('10,000,000,000.00');
    expect(formatSar(1000000000000)).not.toMatch(/e/i);
  });

  it('rejects non-integer halalas', () => {
    expect(() => formatSar(1.5)).toThrow(RangeError);
  });
});

describe('sumHalalas', () => {
  it('adds integers exactly (0.1 + 0.2 = 0.30, no drift)', () => {
    const parts = ['0.1', '0.2'].map((s) => parseDecimalToHalalas(s) ?? 0);
    const total = sumHalalas(parts);
    expect(total).toBe(30);
    expect(formatSar(total)).toBe('0.30');
    expect(formatSar(total)).not.toContain('00004');
  });
});
