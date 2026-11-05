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
import { parseStoredPayload, assetsForProfile } from '@/domain/rehydrate';

export async function rehydrateById(
  id: string,
  fetcher: typeof fetch = fetch,
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
  return makeInput(parsed.doc, parsed.profile, assetsForProfile(parsed.profile));
}
