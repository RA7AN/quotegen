import { describe, it, expect } from 'vitest';
import { formatOrdinalDate, formatOrdinalDateComma, ordinalSuffix, parseIsoDateParts } from './dates';
import { quotationFilename, proformaFilename, buildFilename, normaliseSpacing } from './filenames';
import { escapeHtml, escapeHtmlWithBreaks, fillIn } from './escape';

describe('dates (ordinal, no Intl)', () => {
  it('formats ordinal dates with correct suffixes', () => {
    expect(formatOrdinalDate('2026-10-17')).toBe('17th October 2026');
    expect(formatOrdinalDate('2026-11-01')).toBe('1st November 2026');
    expect(formatOrdinalDate('2026-11-02')).toBe('2nd November 2026');
    expect(formatOrdinalDate('2026-11-03')).toBe('3rd November 2026');
    expect(formatOrdinalDate('2026-11-11')).toBe('11th November 2026');
    expect(formatOrdinalDate('2026-12-21')).toBe('21st December 2026');
    expect(formatOrdinalDateComma('2026-11-16')).toBe('16th November, 2026');
  });
  it('validates ranges and leap years', () => {
    expect(ordinalSuffix(13)).toBe('th');
    expect(parseIsoDateParts('2026-02-29')).toBeNull(); // 2026 not a leap year
    expect(parseIsoDateParts('2024-02-29')?.day).toBe(29);
    expect(parseIsoDateParts('2026-13-01')).toBeNull();
    expect(() => formatOrdinalDate('2026-13-01')).toThrow(RangeError);
  });
});

describe('filenames (FR-7.3, AC-22)', () => {
  it('quotation: uses the doc number verbatim', () => {
    expect(quotationFilename('ENCM-26-6879')).toBe('ENCM-26-6879.pdf');
    expect(quotationFilename('ENCM-178-26-6824')).toBe('ENCM-178-26-6824.pdf');
  });
  it('proforma: single space, trimmed', () => {
    expect(proformaFilename('5799-00')).toBe('PROFORMA INVOICE 5799-00.pdf');
    expect(buildFilename({ template: 'proforma', docNo: '  5799-00  ' })).toBe(
      'PROFORMA INVOICE 5799-00.pdf',
    );
  });
  it('strips path-hostile characters', () => {
    expect(normaliseSpacing('a   b')).toBe('a b');
    expect(quotationFilename('ENCM/26:6879')).toBe('ENCM266879.pdf');
  });
});

describe('escape (FR-8.1, AC-27)', () => {
  it('escapes HTML-significant characters', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
    expect(escapeHtml('A & B')).toBe('A &amp; B');
  });
  it('escape-then-substitute keeps values literal, newlines become breaks', () => {
    expect(escapeHtmlWithBreaks('x\ny')).toBe('x<br>y');
    expect(fillIn('Kindly find the attached quotation for {subject}.', { subject: '<b>' })).toBe(
      'Kindly find the attached quotation for &lt;b&gt;.',
    );
    expect(fillIn('Cust ID: {custId}', {})).toBe('Cust ID: ');
  });
});
