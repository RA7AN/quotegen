import { describe, it, expect } from 'vitest';
import { QuoteDocumentSchema } from './types';
import { createBlankQuoteDocument } from './defaults';

describe('QuoteDocumentSchema boundary (Zod)', () => {
  it('parses a full valid document and applies inner defaults', () => {
    const parsed = QuoteDocumentSchema.parse({
      schemaVersion: 1,
      template: 'quotation',
      meta: {
        docNo: 'ENCM-26-6879',
        quoteDateISO: '2026-10-25',
        validUntilISO: '2026-11-24',
        subject: 'Kidds Club Floor',
        attn: 'Mr Mithun',
      },
      client: { name: 'Turtle Bay Hotel (TBH)' },
      lines: [
        { id: 'a', description: 'd', uom: 'u', qtyHundredths: 100, unitPriceHalalas: 1950000 },
      ],
      closing: { signoff: 'Best regards,', name: '', org: '', mobile: '', email: '', website: '' },
    });
    // omitted optional/inner-defaulted fields are filled in
    expect(parsed.commercials.vatBps).toBe(1500);
    expect(parsed.commercials.discountMode).toBe('none');
    expect(parsed.client.addressLines).toEqual([]);
    expect(parsed.lines[0]?.pricing).toBe('rated');
  });

  it('rejects a missing document number and a bad date', () => {
    expect(() =>
      QuoteDocumentSchema.parse({
        schemaVersion: 1,
        template: 'quotation',
        meta: { docNo: '', quoteDateISO: '2026-13-40', validUntilISO: 'x', subject: '', attn: '' },
        client: { name: 'C' },
        closing: { signoff: '', name: '', org: '', mobile: '', email: '', website: '' },
      }),
    ).toThrow();
  });

  it('factory blank document carries the seeded terms and VAT', () => {
    const blank = createBlankQuoteDocument('quotation');
    expect(blank.terms.clauses.length).toBeGreaterThan(0);
    expect(blank.commercials.vatBps).toBe(1500);
  });
});
