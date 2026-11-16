import { describe, expect, it } from 'vitest';
import { parseStoredPayload, assetsForProfile, assetsWithOverrides, STATIC_BRAND_ASSETS } from './rehydrate';
import { DEFAULT_COMPANY_PROFILE } from './defaults';
import { createBlankQuoteDocument } from './defaults';
import type { QuoteDocument } from './types';

// A minimal-but-valid document is derived from the factory blank + the required
// meta fields MetaSchema enforces (docNo + valid yyyy-mm-dd dates).
function validDoc(): QuoteDocument {
  const doc = createBlankQuoteDocument('quotation');
  doc.meta.docNo = 'ENCM-26-6879';
  doc.meta.quoteDateISO = '2026-10-25';
  doc.meta.validUntilISO = '2026-11-24';
  doc.client.name = 'Turtle Bay Hotel';
  return doc;
}

describe('parseStoredPayload (#12)', () => {
  it('accepts the full render envelope ({ doc, profile })', () => {
    const parsed = parseStoredPayload({ doc: validDoc(), profile: DEFAULT_COMPANY_PROFILE });
    expect(parsed).not.toBeNull();
    expect(parsed!.doc.meta.docNo).toBe('ENCM-26-6879');
    expect(parsed!.profile.legalNameEn).toBe(DEFAULT_COMPANY_PROFILE.legalNameEn);
  });

  it('falls back to the factory profile for a legacy bare-document payload', () => {
    const parsed = parseStoredPayload(validDoc()); // #10 slice 3 shape
    expect(parsed).not.toBeNull();
    expect(parsed!.doc.client.name).toBe('Turtle Bay Hotel');
    expect(parsed!.profile).toBe(DEFAULT_COMPANY_PROFILE);
  });

  it('returns null for a non-document payload (never throws)', () => {
    expect(parseStoredPayload(null)).toBeNull();
    expect(parseStoredPayload(undefined)).toBeNull();
    expect(parseStoredPayload({ nope: true })).toBeNull();
    // envelope present but doc invalid (missing required meta)
    expect(parseStoredPayload({ doc: { schemaVersion: 1 }, profile: DEFAULT_COMPANY_PROFILE })).toBeNull();
  });
});

describe('assetsForProfile (#12)', () => {
  it('maps profile logos to header/footer marks and pins the static brand bands', () => {
    const assets = assetsForProfile({ ...DEFAULT_COMPANY_PROFILE, logos: { headerMark: '/x/h.png', footerMark: '/x/f.png' } });
    expect(assets.headerMark).toBe('/x/h.png');
    expect(assets.footerMark).toBe('/x/f.png');
    expect(assets.headerBand).toBe(STATIC_BRAND_ASSETS.headerBand);
    expect(assets.footerStripProforma).toBe(STATIC_BRAND_ASSETS.footerStripProforma);
  });
});

describe('#5 assetsWithOverrides', () => {
  const profile = { ...DEFAULT_COMPANY_PROFILE, logos: { headerMark: '/x/h.png', footerMark: '/x/f.png' } };

  it('lets a stored override replace the profile crop, leaving the other slot intact', () => {
    const assets = assetsWithOverrides(profile, { headerMark: 'data:image/png;base64,AAA' });
    expect(assets.headerMark).toBe('data:image/png;base64,AAA');
    expect(assets.footerMark).toBe('/x/f.png');
  });

  it('falls back to the profile crop for a null / empty override', () => {
    expect(assetsWithOverrides(profile, { headerMark: null }).headerMark).toBe('/x/h.png');
    expect(assetsWithOverrides(profile, { footerMark: '' }).footerMark).toBe('/x/f.png');
    expect(assetsWithOverrides(profile).headerMark).toBe('/x/h.png');
  });

  it('always keeps the coloured bands bundled regardless of overrides', () => {
    const assets = assetsWithOverrides(profile, { headerMark: 'data:image/png;base64,AAA', footerMark: 'data:image/png;base64,BBB' });
    expect(assets.headerBand).toBe(STATIC_BRAND_ASSETS.headerBand);
    expect(assets.footerStrip).toBe(STATIC_BRAND_ASSETS.footerStrip);
  });

  it('assetsForProfile is the no-override path', () => {
    expect(assetsForProfile(profile)).toEqual(assetsWithOverrides(profile));
  });
});
