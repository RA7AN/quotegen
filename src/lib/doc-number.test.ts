import { describe, it, expect } from 'vitest';
import {
  parseQuotationDocNo,
  composeQuotationDocNo,
  parseProformaDocNo,
  composeProformaDocNo,
  normalisePrefix,
  defaultQuotationSegments,
  defaultProformaSegments,
  segmentsFor,
} from './doc-number';

describe('parseQuotationDocNo (real reference shapes)', () => {
  it('parses ENCM-YY-SEQ with no project (canonical 6879 form)', () => {
    expect(parseQuotationDocNo('ENCM-26-6879')).toEqual({
      prefix: 'ENCM-',
      project: '',
      year: '26',
      seq: '6879',
    });
  });

  it('parses ENCM-PROJ-YY-SEQ (178-project form)', () => {
    expect(parseQuotationDocNo('ENCM-178-26-6824')).toEqual({
      prefix: 'ENCM-',
      project: '178',
      year: '26',
      seq: '6824',
    });
  });

  it('parses a 4-digit year so 2026 style survives round-trip', () => {
    expect(parseQuotationDocNo('ENCM-2026-0001')).toEqual({
      prefix: 'ENCM-',
      project: '',
      year: '2026',
      seq: '0001',
    });
  });

  it('parses a custom letters-only prefix (no project)', () => {
    expect(parseQuotationDocNo('PI-26-1')).toEqual({
      prefix: 'PI-',
      project: '',
      year: '26',
      seq: '1',
    });
  });

  it('treats the middle digit run as project when present (greedy parse)', () => {
    expect(parseQuotationDocNo('PI-9-26-1')).toEqual({
      prefix: 'PI-',
      project: '9',
      year: '26',
      seq: '1',
    });
  });

  it('returns null for empty / whitespace / unparseable shapes', () => {
    expect(parseQuotationDocNo('')).toBeNull();
    expect(parseQuotationDocNo('   ')).toBeNull();
    expect(parseQuotationDocNo('5799-00')).toBeNull();
    expect(parseQuotationDocNo('GARBAGE VALUE')).toBeNull();
    expect(parseQuotationDocNo('ENCM-1-2-3-4')).toBeNull();
  });
});

describe('composeQuotationDocNo', () => {
  it('composes without project (drops the middle dash)', () => {
    expect(
      composeQuotationDocNo({ prefix: 'ENCM-', project: '', year: '26', seq: '6879' }),
    ).toBe('ENCM-26-6879');
  });

  it('composes with project segment', () => {
    expect(
      composeQuotationDocNo({ prefix: 'ENCM-', project: '178', year: '26', seq: '6824' }),
    ).toBe('ENCM-178-26-6824');
  });

  it('normalises a prefix that lacks the trailing dash', () => {
    expect(
      composeQuotationDocNo({ prefix: 'ENCM', project: '', year: '26', seq: '1' }),
    ).toBe('ENCM-26-1');
  });

  it('throws when required segments are blank', () => {
    expect(() => composeQuotationDocNo({ prefix: '', project: '', year: '26', seq: '1' })).toThrow(
      RangeError,
    );
    expect(() => composeQuotationDocNo({ prefix: 'ENCM-', project: '', year: '', seq: '1' })).toThrow(
      RangeError,
    );
    expect(() => composeQuotationDocNo({ prefix: 'ENCM-', project: '', year: '26', seq: '' })).toThrow(
      RangeError,
    );
  });

  it('round-trips every reference docNo we have', () => {
    for (const value of ['ENCM-26-6879', 'ENCM-178-26-6824', 'ENCM-26-9999', 'ENCM-2026-1']) {
      const parsed = parseQuotationDocNo(value);
      expect(parsed, `parse ${value}`).not.toBeNull();
      expect(composeQuotationDocNo(parsed!)).toBe(value);
    }
  });
});

describe('parseProformaDocNo / composeProformaDocNo', () => {
  it('parses 5799-00 (the reference file)', () => {
    expect(parseProformaDocNo('5799-00')).toEqual({ seq: '5799', suffix: '00' });
  });

  it('parses a seq with no suffix', () => {
    expect(parseProformaDocNo('5799')).toEqual({ seq: '5799', suffix: '' });
  });

  it('rejects quotation-shaped strings and empty input', () => {
    expect(parseProformaDocNo('ENCM-26-6879')).toBeNull();
    expect(parseProformaDocNo('')).toBeNull();
    expect(parseProformaDocNo('abc-00')).toBeNull();
  });

  it('composes with or without suffix, and round-trips', () => {
    expect(composeProformaDocNo({ seq: '5799', suffix: '00' })).toBe('5799-00');
    expect(composeProformaDocNo({ seq: '5799', suffix: '' })).toBe('5799');
    expect(() => composeProformaDocNo({ seq: '', suffix: '00' })).toThrow(RangeError);
    const parsed = parseProformaDocNo('5799-00')!;
    expect(composeProformaDocNo(parsed)).toBe('5799-00');
  });
});

describe('normalisePrefix', () => {
  it('appends a dash when missing, leaves present, collapses blank', () => {
    expect(normalisePrefix('ENCM')).toBe('ENCM-');
    expect(normalisePrefix('ENCM-')).toBe('ENCM-');
    expect(normalisePrefix('  ENCM  ')).toBe('ENCM-');
    expect(normalisePrefix('')).toBe('');
  });
});

describe('default segments', () => {
  it('uses the ENCM / 178 / caller-year / 6879 defaults for quotation', () => {
    expect(defaultQuotationSegments('26')).toEqual({
      prefix: 'ENCM-',
      project: '178',
      year: '26',
      seq: '6879',
    });
  });

  it('uses 5799 / 00 for proforma', () => {
    expect(defaultProformaSegments()).toEqual({ seq: '5799', suffix: '00' });
  });
});

describe('segmentsFor (parse-or-fallback)', () => {
  it('returns fallback on blank docNo (new wizard)', () => {
    const fallback = defaultQuotationSegments('26');
    expect(segmentsFor('quotation', '', fallback)).toBe(fallback);
  });

  it('returns parsed segments on a well-formed docNo', () => {
    expect(
      segmentsFor('quotation', 'ENCM-178-26-6824', defaultQuotationSegments('26')),
    ).toEqual({ prefix: 'ENCM-', project: '178', year: '26', seq: '6824' });
  });

  it('returns fallback on unparseable docNo so the UI keeps something valid', () => {
    const fallback = defaultQuotationSegments('26');
    expect(segmentsFor('quotation', 'GARBAGE', fallback)).toBe(fallback);
  });

  it('dispatches proforma correctly', () => {
    expect(
      segmentsFor('proforma', '5799-00', defaultProformaSegments()),
    ).toEqual({ seq: '5799', suffix: '00' });
  });
});
