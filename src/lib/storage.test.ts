import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  browserKV,
  clearDraft,
  debounce,
  deleteQuote,
  duplicateQuote,
  KEYS,
  listQuotes,
  loadBrandAssets,
  loadProfile,
  MAX_ASSET_BYTES,
  migrateDoc,
  normalizeRestoredStep,
  openQuoteAsDraft,
  readAssets,
  readDraft,
  readProfile,
  readProfilePick,
  resetAssets,
  resetProfile,
  upsertQuote,
  validateImageFile,
  writeAsset,
  writeDraft,
  writeProfile,
  writeProfilePick,
  type KVStorage,
  type SavedQuote,
} from './storage';
import { createBlankQuoteDocument, DEFAULT_COMPANY_PROFILE } from '@/domain/defaults';
import { SCHEMA_VERSION, type QuoteDocument } from '@/domain/types';

/** In-memory KVStorage standing in for localStorage in Node. */
function memoryKV(initial: Record<string, string> = {}): KVStorage & { map: Map<string, string> } {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v); },
    removeItem: (k) => { map.delete(k); },
  };
}

const doc = (): QuoteDocument => ({
  ...createBlankQuoteDocument('quotation'),
  meta: { docNo: 'ENCM-26-6879', quoteDateISO: '2026-10-25', validUntilISO: '2026-11-24', subject: 'Kidds Club', attn: 'Mr Mithun' },
  client: { name: 'Turtle Bay Hotel (TBH)', addressLines: ['Jeddah'], custId: '0020TBH', city: 'Al Umlaj', crNo: '4701102147' },
  lines: [{ id: 'l1', description: 'Worktop', uom: 'u', qtyHundredths: 100, unitPriceHalalas: 530000, pricing: 'rated' }],
});

describe('draft codec — FR-6.1 / AC-12', () => {
  it('round-trips doc + step', () => {
    const kv = memoryKV();
    writeDraft(kv, 2, doc());
    const restored = readDraft(kv);
    expect(restored).not.toBeNull();
    expect(restored?.step).toBe(2);
    expect(restored?.doc.meta.docNo).toBe('ENCM-26-6879');
    expect(restored?.doc.lines).toHaveLength(1);
    expect(restored?.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('restoring a step-4 (review) draft lands on step 3 (never straight into export)', () => {
    const kv = memoryKV();
    writeDraft(kv, 4, doc());
    expect(readDraft(kv)?.step).toBe(3);
    expect(normalizeRestoredStep(1)).toBe(1);
    expect(normalizeRestoredStep(2)).toBe(2);
    expect(normalizeRestoredStep(3)).toBe(3);
    expect(normalizeRestoredStep(4)).toBe(3);
  });

  it('clearDraft removes the slot', () => {
    const kv = memoryKV();
    writeDraft(kv, 1, doc());
    clearDraft(kv);
    expect(readDraft(kv)).toBeNull();
  });

  it('EC-11: corrupt, foreign, empty and future-version payloads decode to null, never throw', () => {
    expect(readDraft(memoryKV({ [KEYS.draft]: '{not json' }))).toBeNull();
    expect(readDraft(memoryKV({ [KEYS.draft]: '42' }))).toBeNull();
    expect(readDraft(memoryKV({ [KEYS.draft]: JSON.stringify({ step: 1, doc: { nope: true } }) }))).toBeNull();
    const future = JSON.stringify({ schemaVersion: 99, step: 1, doc: { ...doc(), schemaVersion: 99 } });
    expect(readDraft(memoryKV({ [KEYS.draft]: future }))).toBeNull();
    expect(readDraft(memoryKV())).toBeNull();
  });

  it('AC-13: a v0 draft (no schemaVersion, sparse sections) still opens, defaults filled', () => {
    const v0 = {
      template: 'quotation',
      meta: { docNo: 'ENCM-26-1000', quoteDateISO: '2026-01-01', validUntilISO: '2026-02-01', subject: 'Old' },
      client: { name: 'Old Client' },
      lines: [{ id: 'a', description: 'Item', uom: 'm', qtyHundredths: 250, unitPriceHalalas: 1234 }],
    };
    const kv = memoryKV({ [KEYS.draft]: JSON.stringify({ step: 2, doc: v0 }) });
    const restored = readDraft(kv);
    expect(restored).not.toBeNull();
    expect(restored?.schemaVersion).toBe(SCHEMA_VERSION);
    expect(restored?.doc.schemaVersion).toBe(SCHEMA_VERSION);
    expect(restored?.doc.lines[0]?.pricing).toBe('rated');
    expect(restored?.doc.commercials.vatBps).toBe(1500);
    expect(restored?.doc.terms.clauses).toEqual([]);
    expect(restored?.doc.closing.signoff).toBe('');
  });

  it('migrateDoc refuses arrays and non-objects', () => {
    expect(migrateDoc(null)).toBeNull();
    expect(migrateDoc([])).toBeNull();
    expect(migrateDoc('x')).toBeNull();
  });
});

describe('saved snapshots — FR-6.2 / AC-13', () => {
  const saved = (id: string, name: string): SavedQuote => ({
    id, name, savedAtISO: '2026-11-03T00:00:00Z', doc: doc(),
  });

  it('save → list order, upsert replaces by id', () => {
    const kv = memoryKV();
    expect(listQuotes(kv)).toEqual([]);
    upsertQuote(kv, saved('q1', 'Red Sea worktop'));
    upsertQuote(kv, saved('q2', 'Second'));
    expect(listQuotes(kv).map((q) => q.id)).toEqual(['q1', 'q2']);
    const updated = saved('q1', 'Renamed');
    updated.doc.meta.docNo = 'ENCM-26-9999';
    upsertQuote(kv, updated);
    expect(listQuotes(kv)).toHaveLength(2);
    expect(listQuotes(kv)[0]?.name).toBe('Renamed');
    expect(listQuotes(kv)[0]?.doc.meta.docNo).toBe('ENCM-26-9999');
  });

  it('HP-4: duplicate is independent — changing its docNo leaves the original untouched', () => {
    const kv = memoryKV();
    upsertQuote(kv, saved('q1', 'Original'));
    const copy = duplicateQuote(kv, 'q1', { newId: 'q2', name: 'Copy', savedAtISO: '2026-11-03T01:00:00Z', docNo: 'ENCM-26-7000' });
    expect(copy?.doc.meta.docNo).toBe('ENCM-26-7000');
    const list = listQuotes(kv);
    expect(list.map((q) => q.id)).toEqual(['q1', 'q2']);
    expect(list[0]?.doc.meta.docNo).toBe('ENCM-26-6879'); // original unchanged
    expect(duplicateQuote(kv, 'missing', { newId: 'x', name: 'x', savedAtISO: '' })).toBeNull();
  });

  it('delete removes only the target', () => {
    const kv = memoryKV();
    upsertQuote(kv, saved('q1', 'A'));
    upsertQuote(kv, saved('q2', 'B'));
    const rest = deleteQuote(kv, 'q1');
    expect(rest.map((q) => q.id)).toEqual(['q2']);
  });

  it('openQuoteAsDraft seeds the wizard with an independent copy', () => {
    const kv = memoryKV();
    upsertQuote(kv, saved('q1', 'A'));
    const opened = openQuoteAsDraft(kv, 'q1');
    expect(opened?.meta.docNo).toBe('ENCM-26-6879');
    const draft = readDraft(kv);
    draft?.doc.lines.push({ id: 'z', description: 'extra', uom: 'u', qtyHundredths: 1, unitPriceHalalas: 1, pricing: 'rated' });
    writeDraft(kv, 1, draft?.doc ?? doc());
    expect(listQuotes(kv)[0]?.doc.lines).toHaveLength(1); // snapshot untouched by draft edits
  });

  it('EC-11: one corrupt entry is skipped, readable entries survive; garbage list reads empty', () => {
    const mixed = {
      schemaVersion: SCHEMA_VERSION,
      items: [{ id: 'bad', name: 'x', savedAtISO: '', doc: { junk: true } }, saved('ok', 'Fine')],
    };
    const kv = memoryKV({ [KEYS.quotes]: JSON.stringify(mixed) });
    expect(listQuotes(kv).map((q) => q.id)).toEqual(['ok']);
    expect(listQuotes(memoryKV({ [KEYS.quotes]: '!!' }))).toEqual([]);
  });
});

describe('company profile — FR-5.1 / FR-5.2', () => {
  it('falls back to the factory profile when nothing is stored', () => {
    expect(readProfile(memoryKV())).toBeNull();
    expect(loadProfile(memoryKV()).legalNameEn).toBe(DEFAULT_COMPANY_PROFILE.legalNameEn);
  });

  it('round-trips an edited profile and resets to factory defaults', () => {
    const kv = memoryKV();
    const edited = { ...DEFAULT_COMPANY_PROFILE, bankName: 'Al Rajhi', iban: 'SA 00 0000 0000 0000 0000 0000' };
    writeProfile(kv, edited);
    expect(readProfile(kv)?.bankName).toBe('Al Rajhi');
    expect(loadProfile(kv).bankName).toBe('Al Rajhi');
    const fresh = resetProfile(kv);
    expect(fresh).toEqual(DEFAULT_COMPANY_PROFILE);
    // #6: the factory profile now ships the full bank identity (reference proforma),
    // so a reset restores the seeded value rather than an empty string.
    expect(readProfile(kv)?.bankName).toBe(DEFAULT_COMPANY_PROFILE.bankName);
  });

  it('corrupt profile JSON reads as null (falls back to defaults)', () => {
    expect(readProfile(memoryKV({ [KEYS.profile]: '{oops' }))).toBeNull();
  });
});

describe('per-quote profile pick — #31 part 1', () => {
  it('reads null when nothing is chosen (account default)', () => {
    expect(readProfilePick(memoryKV())).toBeNull();
  });

  it('round-trips a chosen library-profile id in its own slot', () => {
    const kv = memoryKV();
    writeProfilePick(kv, 'p-42');
    expect(readProfilePick(kv)).toBe('p-42');
    expect(kv.map.get(KEYS.profilePick)).toBe('p-42');
  });

  it('clears the slot on null / empty (back to the account default)', () => {
    const kv = memoryKV({ [KEYS.profilePick]: 'p-42' });
    writeProfilePick(kv, null);
    expect(kv.map.has(KEYS.profilePick)).toBe(false);
    writeProfilePick(kv, 'p-7');
    writeProfilePick(kv, '');
    expect(readProfilePick(kv)).toBeNull();
  });
});

describe('autosave debounce — FR-6.1', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires once on the trailing edge with the latest value', () => {
    const seen: number[] = [];
    const save = debounce((n: number) => seen.push(n), 400);
    save(1);
    vi.advanceTimersByTime(200);
    save(2);
    vi.advanceTimersByTime(200);
    save(3);
    vi.advanceTimersByTime(400);
    expect(seen).toEqual([3]);
  });

  it('cancel prevents the pending write', () => {
    const seen: number[] = [];
    const save = debounce((n: number) => seen.push(n), 400);
    save(1);
    save.cancel();
    vi.advanceTimersByTime(1000);
    expect(seen).toEqual([]);
  });
});

describe('browserKV — SSR safety', () => {
  it('returns a no-op store when window is absent (Node)', () => {
    const kv = browserKV();
    kv.setItem('k', 'v');
    expect(kv.getItem('k')).toBeNull();
  });
});

describe('#5 brand asset codec — readAssets / loadBrandAssets', () => {
  const PNG = 'data:image/png;base64,iVBORw0KGgo=';

  it('returns null when the slot is absent, and an all-null envelope via load', () => {
    const kv = memoryKV();
    expect(readAssets(kv)).toBeNull();
    expect(loadBrandAssets(kv)).toEqual({ schemaVersion: SCHEMA_VERSION, headerMark: null, footerMark: null });
  });

  it('decodes corrupt JSON and a future schemaVersion to null (EC-11 parity)', () => {
    expect(readAssets(memoryKV({ [KEYS.assets]: '{not json' }))).toBeNull();
    expect(readAssets(memoryKV({ [KEYS.assets]: JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1, headerMark: PNG }) }))).toBeNull();
  });

  it('drops a non-image value in a slot but keeps a valid one', () => {
    const kv = memoryKV({ [KEYS.assets]: JSON.stringify({ schemaVersion: SCHEMA_VERSION, headerMark: 'javascript:alert(1)', footerMark: PNG }) });
    const assets = readAssets(kv);
    expect(assets?.headerMark).toBeNull();
    expect(assets?.footerMark).toBe(PNG);
  });
});

describe('#5 brand asset codec — writeAsset / resetAssets', () => {
  const PNG = 'data:image/png;base64,iVBORw0KGgo=';
  const JPG = 'data:image/jpeg;base64,/9j/4AAQ=';

  it('sets one slot and preserves the other', () => {
    const kv = memoryKV();
    expect(writeAsset(kv, 'headerMark', PNG)).toEqual({ ok: true });
    expect(writeAsset(kv, 'footerMark', JPG)).toEqual({ ok: true });
    expect(loadBrandAssets(kv)).toMatchObject({ headerMark: PNG, footerMark: JPG });
  });

  it('clears a slot when written null', () => {
    const kv = memoryKV();
    writeAsset(kv, 'headerMark', PNG);
    writeAsset(kv, 'headerMark', null);
    expect(loadBrandAssets(kv).headerMark).toBeNull();
  });

  it('rejects a malformed data URL without touching storage', () => {
    const kv = memoryKV();
    expect(writeAsset(kv, 'headerMark', 'data:application/pdf;base64,AAA')).toEqual({ ok: false, error: 'invalid' });
    expect(kv.map.has(KEYS.assets)).toBe(false);
  });

  it('reports a quota failure when the write throws (EC-12)', () => {
    const kv: KVStorage = {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceededError'); },
      removeItem: () => {},
    };
    expect(writeAsset(kv, 'headerMark', PNG)).toEqual({ ok: false, error: 'quota' });
  });

  it('resetAssets removes the whole envelope', () => {
    const kv = memoryKV();
    writeAsset(kv, 'headerMark', PNG);
    resetAssets(kv);
    expect(readAssets(kv)).toBeNull();
  });
});

describe('#5 validateImageFile guards', () => {
  it('accepts a supported, non-empty image within the size cap', () => {
    expect(validateImageFile({ type: 'image/png', size: 10_000 })).toBeNull();
  });
  it('rejects an unsupported type', () => {
    expect(validateImageFile({ type: 'image/svg+xml', size: 100 })).toMatch(/PNG, JPEG, GIF or WebP/);
  });
  it('rejects an empty file', () => {
    expect(validateImageFile({ type: 'image/png', size: 0 })).toMatch(/empty/);
  });
  it('rejects an over-cap file and cites the limit', () => {
    expect(validateImageFile({ type: 'image/png', size: MAX_ASSET_BYTES + 1 })).toMatch(/too large/);
  });
});
