/**
 * documents/rerender.ts — rebuild a PDF render input from a stored document (#12 slice 2).
 *
 * The deterministic core guarantees identical bytes from identical inputs (AC-6/EC-14),
 * so a stored row needs no archived binary: we fetch its persisted { doc, profile },
 * rehydrate through the pure boundary (parseStoredPayload — legacy bare-document rows
 * included), and reassemble the fully-resolved PdfInput the wizard already renders.
 * Returns null on any miss (404 / unparseable payload) so the UI degrades to an error
 * state instead of throwing across the network boundary.
 */
import { makeInput } from '@/pdf/index';
import type { PdfInput } from '@/pdf/input';
import { parseStoredPayload, assetsWithOverrides, type BrandAssetOverrides } from '@/domain/rehydrate';
import { browserKV, loadBrandAssets } from '@/lib/storage';

export async function rehydrateById(
  id: string,
  fetcher: typeof fetch = fetch,
  overrides?: BrandAssetOverrides | null,
): Promise<PdfInput | null> {
  const res = await fetcher(`/api/documents/${id}`);
  if (!res.ok) return null;

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return null;
  }

  const parsed = parseStoredPayload((body as { payload?: unknown } | null)?.payload);
  if (!parsed) return null;
  // #5/#38: brand marks are an overlay applied on top of the SNAPSHOT profile (the profile
  // itself is frozen into the row, so past artifacts stay put — AC-6/EC-14). Callers pass
  // the account's server-sourced marks; when absent (anonymous / Node, no window) we fall
  // back to the device-local slot, which is empty there, so the stored profile's bundled
  // crops win and re-render stays deterministic.
  const resolved = overrides ?? loadBrandAssets(browserKV());
  return makeInput(parsed.doc, parsed.profile, assetsWithOverrides(parsed.profile, resolved));
}
