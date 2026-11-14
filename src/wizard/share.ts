/**
 * wizard/share.ts — Web Share API (Level 2, files) helpers for Step 4 export.
 *
 * Mobile browsers (iOS Safari, Android Chrome) expose the native share sheet via
 * `navigator.share({ files })`, which routes the PDF to any installed mail or
 * social app as a real attachment. Desktop coverage is patchy (Chrome on Windows
 * only shares text, Safari has no file share), so detection probes `canShare`
 * with a zero-byte PDF and callers degrade to "download, then attach manually".
 *
 * Pure over the browser globals — no fetch/db, so this stays on the client side
 * of the AC-24 boundary. Every DOM capability access is feature-checked, never
 * assumed.
 */

const PDF_MIME = 'application/pdf';

/** Minimal shape of the Level-2 share data; the official DOM types lag browsers. */
interface FileShareData {
  title?: string;
  text?: string;
  files?: File[];
}

type ShareNavigator = Navigator & {
  canShare?: (data: FileShareData) => boolean;
  share?: (data: FileShareData) => Promise<void>;
};

/** Outcome of a share attempt; 'unsupported' tells the caller to fall back. */
export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported' | 'failed';

export function canSharePdf(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as ShareNavigator;
  if (typeof nav.canShare !== 'function' || typeof nav.share !== 'function') return false;
  try {
    // Same probe File type as the real payload, so a browser that claims text-only
    // sharing still reports false here instead of failing mid-click.
    return nav.canShare({ files: [new File([new Uint8Array(0)], 'probe.pdf', { type: PDF_MIME })] });
  } catch {
    return false; // some engines throw on unknown payload shapes
  }
}

/**
 * Share `blob` as a PDF attachment through the native sheet. A user dismissing
 * the sheet is an AbortError, reported as 'cancelled' (not an error worth a
 * scary toast). 'shared' fires only after the platform promise resolves — the
 * OS does not confirm delivery beyond that.
 */
export async function sharePdfFile(
  blob: Blob,
  filename: string,
  title: string,
  text?: string,
): Promise<{ outcome: ShareOutcome; error?: string }> {
  if (!canSharePdf()) return { outcome: 'unsupported' };
  const nav = navigator as ShareNavigator;
  try {
    const file = new File([blob], filename, { type: PDF_MIME });
    await nav.share?.({ title, text, files: [file] });
    return { outcome: 'shared' };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return { outcome: 'cancelled' };
    return { outcome: 'failed', error: err instanceof Error ? err.message : String(err) };
  }
}
