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
 * from the stored profile; the coloured bands are the static bundled brand assets.
 * The `*MarkOverride` fields (#36) carry ONLY an uploaded data-URL mark — when set,
 * the banner swaps the baked-in header band for the logo-neutral crop and places the
 * mark in the reserved slot. Bundled path crops stay inert (no override = today's
 * baked banner, so the HP goldens remain byte-identical). */
export type RenderAssets = {
  headerMark: string;
  footerMark: string;
  headerBand: string;
  headerBandNeutral: string;
  footerStrip: string;
  footerStripProforma: string;
  headerMarkOverride?: string | null;
  footerMarkOverride?: string | null;
};

export const STATIC_BRAND_ASSETS = {
  headerBand: '/brand/header-band.jpg',
  // #36 logo-free header band: identical artwork with the baked Encompass mark
  // cleared to the band's black; the uploaded mark is placed over the cleared slot.
  headerBandNeutral: '/brand/header-band-blank.png',
  footerStrip: '/brand/footer-strip.jpg',
  footerStripProforma: '/brand/footer-strip-proforma.png',
} as const;

/** Optional per-slot brand-image overrides (#5); falsy = keep the profile's bundled crop. */
export type BrandAssetOverrides = { headerMark?: string | null; footerMark?: string | null };

/** An override is only ever an uploaded data-URL (storage guards, AC-28); a bundled
 * `/brand/*` crop path from the profile is NOT an override and never re-renders the band. */
const isUploadedMark = (mark?: string | null): mark is string =>
  typeof mark === 'string' && mark.startsWith('data:image');

/**
 * Resolve the PdfAssets a render needs from a profile, layering any device-local brand
 * overrides (uploaded marks held in the `quotegen:assets:v1` slot) over the profile's
 * bundled crop paths. The coloured bands are always the static bundled assets; #36 adds
 * the resolved upload (`headerMarkOverride` / `footerMarkOverride`) so the banner can
 * switch to the logo-neutral band WITHOUT `src/pdf` reading storage. Pure —
 * the caller reads the overrides from storage (data-URL in the browser, injected in Node).
 */
export function assetsWithOverrides(profile: CompanyProfile, overrides?: BrandAssetOverrides): RenderAssets {
  const headerMark = overrides?.headerMark || profile.logos.headerMark;
  const footerMark = overrides?.footerMark || profile.logos.footerMark;
  return {
    headerMark,
    footerMark,
    headerMarkOverride: isUploadedMark(headerMark) ? headerMark : null,
    footerMarkOverride: isUploadedMark(footerMark) ? footerMark : null,
    ...STATIC_BRAND_ASSETS,
  };
}

/** Resolve the PdfAssets a client re-render needs from the stored profile (no overrides). */
export function assetsForProfile(profile: CompanyProfile): RenderAssets {
  return assetsWithOverrides(profile);
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
