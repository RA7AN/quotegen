/**
 * domain/rehydrate.ts — parse a stored `documents.payload` back into render inputs (#12).
 *
 * A document row's `payload` is the FULL render input — `{ doc, profile }` — so a PDF
 * can be re-rendered deterministically on open (schema intent) without the user's
 * current device profile: byte-stable re-render must reproduce what was exported, and
 * the company profile is part of the render input (letterhead, sign-off org, logos).
 *
 * Back-compat: #10 slice 3 (before #12) stored the bare QuoteDocument as the payload.
 * `parseStoredPayload` accepts both shapes — a `{ doc, profile }` envelope, or a bare
 * document (profile falls back to the seeded factory so it still renders). Anything
 * that fails validation returns null (EC-11 discipline: the read never throws).
 *
 * Pure + clock/random-free (lives under src/domain, AC-28-safe); shared by the client
 * re-render path and the server read endpoints so both agree on the payload contract.
 */
import { z } from 'zod';
import { CompanyProfileSchema, QuoteDocumentSchema, type CompanyProfile } from './types';
import { DEFAULT_COMPANY_PROFILE } from './defaults';

/** The canonical #12 payload: everything needed to re-render one document. */
export const StoredDocumentPayloadSchema = z.object({
  doc: QuoteDocumentSchema,
  profile: CompanyProfileSchema,
});

export type StoredDocumentPayload = z.infer<typeof StoredDocumentPayloadSchema>;

/** Brand asset paths derived from a profile (browser URLs). Header/footer marks come
 * from the stored profile; the coloured bands are the static bundled brand assets. */
export type RenderAssets = {
  headerMark: string;
  footerMark: string;
  headerBand: string;
  footerStrip: string;
  footerStripProforma: string;
};

export const STATIC_BRAND_ASSETS = {
  headerBand: '/brand/header-band.jpg',
  footerStrip: '/brand/footer-strip.jpg',
  footerStripProforma: '/brand/footer-strip-proforma.png',
} as const;

/** Resolve the PdfAssets a client re-render needs from the stored profile. */
export function assetsForProfile(profile: CompanyProfile): RenderAssets {
  return {
    headerMark: profile.logos.headerMark,
    footerMark: profile.logos.footerMark,
    ...STATIC_BRAND_ASSETS,
  };
}

/**
 * Normalize a stored payload into render inputs, tolerating the legacy bare-document
 * shape. Returns null when the data is not a valid document under any shape.
 */
export function parseStoredPayload(raw: unknown): StoredDocumentPayload | null {
  // Preferred envelope: { doc, profile }
  const enveloped = StoredDocumentPayloadSchema.safeParse(raw);
  if (enveloped.success) return enveloped.data;

  // Legacy (#10 slice 3): the payload WAS the document; fall back to the factory profile.
  const bare = QuoteDocumentSchema.safeParse(raw);
  if (bare.success) return { doc: bare.data, profile: DEFAULT_COMPANY_PROFILE };

  return null;
}
