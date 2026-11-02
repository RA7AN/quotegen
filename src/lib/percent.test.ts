import { describe, it, expect } from 'vitest';
import {
  parsePercentHundredths,
  splitByPercentHundredths,
  percentOf,
  percentsSumTo100,
} from './percent';

describe('parsePercentHundredths', () => {
  it('parses whole and 2dp percents', () => {
    expect(parsePercentHundredths('70')).toBe(7000);
    expect(parsePercentHundredths('33.34')).toBe(3334);
    expect(parsePercentHundredths('100')).toBe(10000);
    expect(parsePercentHundredths('100.01')).toBeNull(); // >100%
    expect(parsePercentHundredths('70.001')).toBeNull(); // >2dp rejected
  });
});

describe('splitByPercentHundredths (AC-3, largest remainder)', () => {
  it('requires the percents to sum to exactly 100%', () => {
    expect(splitByPercentHundredths(1000, [5000, 4000])).toEqual([]);
  });

  it('parts always reconstruct the total exactly', () => {
    const total = 1000; // 10.00
    const percents = [3333, 3333, 3334];
    const parts = splitByPercentHundredths(total, percents);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
    expect(parts).toEqual([333, 333, 334]);
  });

  it('handles EC-3 33/33/34 of 100.00', () => {
    const parts = splitByPercentHundredths(10000, [3300, 3300, 3400]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10000);
  });
});

describe('percentOf', () => {
  it('computes a standalone percentage half-up', () => {
    expect(percentOf(6385950, 7000)).toBe(4470165); // 70% of 63,859.50
    expect(percentsSumTo100([7000])).toBe(false);
  });
});
