import { describe, expect, it, vi } from 'vitest';
import { rehydrateById } from './rerender';
import { DEFAULT_COMPANY_PROFILE, createBlankQuoteDocument } from '@/domain/defaults';
import type { QuoteDocument } from '@/domain/types';

function validDoc(): QuoteDocument {
  const doc = createBlankQuoteDocument('quotation');
  doc.meta.docNo = 'ENCM-26-6879';
  doc.meta.quoteDateISO = '2026-10-25';
  doc.meta.validUntilISO = '2026-11-24';
  doc.client.name = 'Turtle Bay Hotel';
  return doc;
}

// Minimal Response stand-in: the helper only reads `.ok` and `.json()`.
function fakeRes(init: { ok: boolean; json?: () => Promise<unknown> }) {
  return { ok: init.ok, status: init.ok ? 200 : 404, json: init.json ?? (() => Promise.resolve({})) } as Response;
}

describe('rehydrateById (#12 slice 2)', () => {
  it('rebuilds a fully-resolved PdfInput from the stored { doc, profile } envelope', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      fakeRes({ ok: true, json: () => Promise.resolve({ payload: { doc: validDoc(), profile: DEFAULT_COMPANY_PROFILE } }) }),
    );
    const input = await rehydrateById('doc-1', fetcher);
    expect(input).not.toBeNull();
    expect(input!.doc.meta.docNo).toBe('ENCM-26-6879');
    expect(input!.profile.legalNameEn).toBe(DEFAULT_COMPANY_PROFILE.legalNameEn);
    // assets come from the persisted profile's logos + the pinned static bands
    expect(input!.assets.headerMark).toBe(DEFAULT_COMPANY_PROFILE.logos.headerMark);
    expect(input!.assets.headerBand).toBe('/brand/header-band.jpg');
    // totals resolved once by makeInput (pure computeTotals)
    expect(input!.totals).toBeDefined();
    expect(fetcher).toHaveBeenCalledWith('/api/documents/doc-1');
  });

  it('falls back to the factory profile for a legacy bare-document row', async () => {
    const fetcher = vi.fn().mockResolvedValue(fakeRes({ ok: true, json: () => Promise.resolve({ payload: validDoc() }) }));
    const input = await rehydrateById('doc-1', fetcher);
    expect(input).not.toBeNull();
    expect(input!.profile).toBe(DEFAULT_COMPANY_PROFILE);
  });

  it('returns null on a non-ok response (404 / unauthorized)', async () => {
    const fetcher = vi.fn().mockResolvedValue(fakeRes({ ok: false }));
    await expect(rehydrateById('missing', fetcher)).resolves.toBeNull();
  });

  it('returns null when the JSON body is unreadable', async () => {
    const fetcher = vi.fn().mockResolvedValue(fakeRes({ ok: true, json: () => Promise.reject(new Error('bad json')) }));
    await expect(rehydrateById('doc-1', fetcher)).resolves.toBeNull();
  });

  it('returns null when the payload is not a valid document (never throws)', async () => {
    const fetcher = vi.fn().mockResolvedValue(fakeRes({ ok: true, json: () => Promise.resolve({ payload: { nope: true } }) }));
    await expect(rehydrateById('doc-1', fetcher)).resolves.toBeNull();
  });
});
