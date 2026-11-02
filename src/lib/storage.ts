/**
 * lib/storage.ts — versioned localStorage codec (Build-kit/01 FR-6, 05 AC-12/AC-13, EC-11).
 *
 * Three slots, each with a version-suffixed key AND a `schemaVersion` inside the value:
 *   - draft   : the in-progress wizard document + step (autosaved, restorable)
 *   - quotes  : named snapshots (save / list / open / duplicate / delete)
 *   - profile : the issuing-company profile (Settings screen)
 *
 * Discipline:
 *  - Pure codec: every function takes an injected KVStorage, so tests run in Node with
 *    an in-memory stub. No `Date.now()`/`Math.random()` lives here (AC-28 grep gate) —
 *    callers supply ids and timestamps.
 *  - Decode never throws: corrupt/foreign/old-schema data returns `null` (or an empty
 *    list) so the UI can fall back to a blank wizard with a notice instead of crashing
 *    (EC-11).
 *  - Old schemaVersions are migrated up before validation (AC-13): v0 documents simply
 *    lacked the newer fields/defaults, which `migrateDoc` fills in.
 */

import {
  CompanyProfileSchema,
  QuoteDocumentSchema,
  SCHEMA_VERSION,
  type CompanyProfile,
  type QuoteDocument,
} from '@/domain/types';
import { DEFAULT_COMPANY_PROFILE } from '@/domain/defaults';

/** Envelope/schema version this codec writes (FR-6.3). */
export const STORAGE_SCHEMA_VERSION = SCHEMA_VERSION;

/** Version-suffixed storage keys (bump the suffix with a slot format change). */
export const KEYS = {
  draft: 'quotegen:draft:v1',
  quotes: 'quotegen:quotes:v1',
  profile: 'quotegen:profile:v1',
} as const;

/** Minimal Storage surface — localStorage in the browser, a Map in tests. */
export interface KVStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The real browser store, guarded for SSR (returns a no-op store when window is absent). */
export function browserKV(): KVStorage {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  }
  return window.localStorage;
}

// ---------------------------------------------------------------------------
// Schema migration (AC-13)
// ---------------------------------------------------------------------------

/**
 * Upgrade a raw (untrusted) document object to the current schema shape, or return null
 * if it is clearly not a document at all. v0 = anything written before `schemaVersion`
 * existed (or literal 0): newer fields are filled with their defaults.
 */
export function migrateDoc(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const doc = raw as Record<string, unknown>;
  const version = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : 0;
  if (version > STORAGE_SCHEMA_VERSION) return null; // from the future — refuse, don't corrupt
  if (version === STORAGE_SCHEMA_VERSION) return doc;

  // v0 -> v1: top-level sections and line/commercial defaults were added later.
  const lines = Array.isArray(doc.lines)
    ? doc.lines.map((l) => {
        if (!l || typeof l !== 'object') return l;
        const line = l as Record<string, unknown>;
        return { pricing: 'rated', uom: '', description: '', ...line };
      })
    : [];
  const client = { custId: '', city: '', crNo: '', addressLines: [], ...(asObject(doc.client)) };
  const commercials = {
    discountMode: 'none',
    discountValue: 0,
    vatBps: 1500,
    paymentTermsText: [],
    advanceSplits: [],
    ...(asObject(doc.commercials)),
  };
  const terms = { clauses: [], ...(asObject(doc.terms)) };
  const closing = { signoff: '', name: '', org: '', mobile: '', email: '', website: '', ...(asObject(doc.closing)) };
  const meta = { attn: '', subject: '', projectSegment: '', ...(asObject(doc.meta)) };
  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    template: doc.template === 'proforma' ? 'proforma' : 'quotation',
    meta,
    client,
    lines,
    commercials,
    terms,
    closing,
  };
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Migrate + Zod-validate a document. `null` on any failure (EC-11). */
export function decodeDoc(raw: unknown): QuoteDocument | null {
  const migrated = migrateDoc(raw);
  if (migrated === null) return null;
  const parsed = QuoteDocumentSchema.safeParse(migrated);
  return parsed.success ? parsed.data : null;
}

// ---------------------------------------------------------------------------
// Draft (FR-6.1 / AC-12)
// ---------------------------------------------------------------------------

export type WizardStep = 1 | 2 | 3;

export type DraftEnvelope = {
  schemaVersion: number;
  step: WizardStep;
  doc: QuoteDocument;
};

/**
 * Mirror of the reference wizard: never restore straight into the review/export step —
 * entry gates belong to the in-session flow, so a restored step 3 lands on step 2.
 */
export function normalizeRestoredStep(step: WizardStep): WizardStep {
  return step === 3 ? 2 : step;
}

export function encodeDraft(step: WizardStep, doc: QuoteDocument): string {
  const envelope: DraftEnvelope = { schemaVersion: STORAGE_SCHEMA_VERSION, step, doc };
  return JSON.stringify(envelope);
}

/** Returns the draft doc + step, or null when absent/corrupt/foreign. */
export function readDraft(kv: KVStorage): DraftEnvelope | null {
  let parsed: unknown;
  try {
    const raw = kv.getItem(KEYS.draft);
    if (raw === null) return null;
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const env = parsed as Record<string, unknown>;
  const doc = decodeDoc(env.doc);
  if (!doc) return null;
  const step = env.step;
  const safeStep: WizardStep = step === 1 || step === 3 ? (step as WizardStep) : 2;
  return { schemaVersion: STORAGE_SCHEMA_VERSION, step: normalizeRestoredStep(safeStep), doc };
}

export function writeDraft(kv: KVStorage, step: WizardStep, doc: QuoteDocument): void {
  try {
    kv.setItem(KEYS.draft, encodeDraft(step, doc));
  } catch {
    // Quota / unavailable — persistence is best-effort (mirrors reference storage).
  }
}

export function clearDraft(kv: KVStorage): void {
  try {
    kv.removeItem(KEYS.draft);
  } catch {
    // Best-effort.
  }
}

// ---------------------------------------------------------------------------
// Saved snapshots (FR-6.2 / AC-13)
// ---------------------------------------------------------------------------

export type SavedQuote = {
  id: string;
  name: string;
  /** ISO timestamp supplied by the caller — the codec itself stays clock-free. */
  savedAtISO: string;
  doc: QuoteDocument;
};

type QuotesEnvelope = { schemaVersion: number; items: SavedQuote[] };

function readQuotesEnvelope(kv: KVStorage): SavedQuote[] {
  let parsed: unknown;
  try {
    const raw = kv.getItem(KEYS.quotes);
    if (raw === null) return [];
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const items = asObject(parsed).items;
  if (!Array.isArray(items)) return [];
  const out: SavedQuote[] = [];
  for (const item of items) {
    const o = asObject(item);
    const doc = decodeDoc(o.doc);
    if (!doc || typeof o.id !== 'string' || !o.id) continue; // skip unreadable entries, keep the rest
    out.push({
      id: o.id,
      name: typeof o.name === 'string' ? o.name : doc.meta.docNo,
      savedAtISO: typeof o.savedAtISO === 'string' ? o.savedAtISO : '',
      doc,
    });
  }
  return out;
}

function writeQuotesEnvelope(kv: KVStorage, items: SavedQuote[]): void {
  try {
    const env: QuotesEnvelope = { schemaVersion: STORAGE_SCHEMA_VERSION, items };
    kv.setItem(KEYS.quotes, JSON.stringify(env));
  } catch {
    // Best-effort.
  }
}

/** All readable snapshots, newest save last (insertion order). */
export function listQuotes(kv: KVStorage): SavedQuote[] {
  return readQuotesEnvelope(kv);
}

export function getQuote(kv: KVStorage, id: string): SavedQuote | null {
  return readQuotesEnvelope(kv).find((q) => q.id === id) ?? null;
}

/** Insert or replace-by-id; returns the updated list. */
export function upsertQuote(kv: KVStorage, quote: SavedQuote): SavedQuote[] {
  const items = readQuotesEnvelope(kv);
  const at = items.findIndex((q) => q.id === quote.id);
  const copy = structuredClone(quote);
  if (at >= 0) items[at] = copy;
  else items.push(copy);
  writeQuotesEnvelope(kv, items);
  return items;
}

export function deleteQuote(kv: KVStorage, id: string): SavedQuote[] {
  const items = readQuotesEnvelope(kv).filter((q) => q.id !== id);
  writeQuotesEnvelope(kv, items);
  return items;
}

/**
 * Independent copy of a snapshot (HP-4): deep-cloned doc under a fresh id, with an
 * optional docNo change; the original is untouched. Returns null when `id` is unknown.
 */
export function duplicateQuote(
  kv: KVStorage,
  id: string,
  opts: { newId: string; name: string; savedAtISO: string; docNo?: string },
): SavedQuote | null {
  const source = getQuote(kv, id);
  if (!source) return null;
  const doc = structuredClone(source.doc);
  if (opts.docNo && opts.docNo.trim()) doc.meta.docNo = opts.docNo.trim();
  const copy: SavedQuote = { id: opts.newId, name: opts.name, savedAtISO: opts.savedAtISO, doc };
  upsertQuote(kv, copy);
  return copy;
}

/** Load a snapshot into the draft slot so /new opens it in the wizard. */
export function openQuoteAsDraft(kv: KVStorage, id: string): QuoteDocument | null {
  const quote = getQuote(kv, id);
  if (!quote) return null;
  writeDraft(kv, 1, structuredClone(quote.doc));
  return quote.doc;
}

// ---------------------------------------------------------------------------
// Company profile (FR-5.1 / FR-5.2)
// ---------------------------------------------------------------------------

export function readProfile(kv: KVStorage): CompanyProfile | null {
  try {
    const raw = kv.getItem(KEYS.profile);
    if (raw === null) return null;
    const parsed = CompanyProfileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Stored profile when present, otherwise the seeded factory profile (FR-5.2). */
export function loadProfile(kv: KVStorage): CompanyProfile {
  return readProfile(kv) ?? structuredClone(DEFAULT_COMPANY_PROFILE);
}

export function writeProfile(kv: KVStorage, profile: CompanyProfile): void {
  try {
    kv.setItem(KEYS.profile, JSON.stringify(profile));
  } catch {
    // Best-effort.
  }
}

/** Restore the seeded Encompass/Elaf profile and return it (FR-5.2). */
export function resetProfile(kv: KVStorage): CompanyProfile {
  const fresh = structuredClone(DEFAULT_COMPANY_PROFILE);
  writeProfile(kv, fresh);
  return fresh;
}

// ---------------------------------------------------------------------------
// Autosave debounce (FR-6.1)
// ---------------------------------------------------------------------------

/** Trailing-edge debounce built on setTimeout only — no clock reads (AC-28-safe). */
export function debounce<A>(fn: (arg: A) => void, waitMs: number): ((arg: A) => void) & { cancel(): void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = (arg: A): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      fn(arg);
    }, waitMs);
  };
  debounced.cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  return debounced;
}
