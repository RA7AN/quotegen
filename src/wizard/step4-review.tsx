/**
 * wizard/step4-review.tsx — Step 4: review & export (FR-2.1, FR-7).
 *
 * The preview IS the PDF (`<PDFViewer>` over the exact element `renderToBlob` prints —
 * 02 §1 "single source of truth", no HTML/PDF divergence). Terms clauses and the sign-off
 * block now live on step 3, so this step is purely preview + export. Download/Print/Share/
 * Save handlers are owned by the wizard. Share opens the device's native sheet (Web Share
 * Level 2) with the PDF attached; `nativeShare` only tunes the tooltip because the wizard
 * falls back to a Download when the browser can't share files.
 *
 * The viewer is isolated in `PdfPreview` because @react-pdf's `PDFViewer` keys its render
 * effect on the identity of its `children`: a new element object means a fresh blob URL,
 * an iframe `src` swap and a full document reload — which reads as the preview blanking
 * and jumping back to page 1. `buildElement` used to run inline in JSX, so ANY unrelated
 * wizard re-render (typing in the export panel, a toast auto-dismissing, a draft-save
 * spinner) restarted the preview the user was reading. Memoizing the element on `input`
 * plus `memo` on the component means the PDF only re-renders when the document data
 * actually changes (`input` is memoized upstream in the wizard).
 *
 * #50 (the reported "I can't see the preview on stage 4"): the viewer used to be a fixed
 * `height={900}` iframe in a `min-h-[640px]` box — taller than the whole 844 px viewport, so
 * on a phone only its top ~36 % was ever visible and reaching the rest scrolled every export
 * control off-screen. The box is now viewport-relative (`h-[60svh]`), and phones get a
 * Full-screen toggle that resizes the SAME single `PdfPreview` instance to the whole viewport
 * with a compact export bar overlaid — never a second viewer, which would break the memo
 * stability this file is built around.
 */

import { memo, useMemo, useState } from 'react';
import { PDFViewer } from '@react-pdf/renderer';
import { buildElement } from '@/pdf/index';
import { inputClass } from './fields';
import type { PdfInput } from '@/pdf/input';

const PdfPreview = memo(function PdfPreview({ input }: { input: PdfInput }) {
  const doc = useMemo(() => buildElement(input), [input]);
  return (
    <PDFViewer width="100%" height="100%" showToolbar>
      {doc}
    </PDFViewer>
  );
});

const EXPORT_BTN = 'min-h-[2.75rem] rounded px-4 text-sm font-medium';

export function Step4Review({
  input,
  onDownload,
  onPrint,
  onShare,
  sharing,
  nativeShare,
  onSaveQuote,
  saveName,
  setSaveName,
}: {
  input: PdfInput;
  onDownload: () => void;
  onPrint: () => void;
  onShare: () => void;
  sharing: boolean;
  nativeShare: boolean;
  onSaveQuote: () => void;
  saveName: string;
  setSaveName: (v: string) => void;
}) {
  // One viewer instance; fullscreen just resizes its box (never remounts the document).
  const [fullscreen, setFullscreen] = useState(false);

  const shareTitle = nativeShare
    ? 'Share the PDF as an attachment via mail or social apps on this device'
    : 'This browser has no share sheet — downloads the PDF so you can attach it yourself';

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      <div className={`space-y-4 ${fullscreen ? 'hidden' : ''}`}>
        <div className="space-y-2 rounded border border-neutral-200 bg-panel p-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Export</h3>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onDownload}
              className={`${EXPORT_BTN} bg-black font-semibold text-white hover:bg-neutral-800`}
            >
              Download PDF
            </button>
            <button
              type="button"
              onClick={onPrint}
              className={`${EXPORT_BTN} border border-neutral-400 hover:bg-neutral-100`}
            >
              Print
            </button>
            <button
              type="button"
              onClick={onShare}
              disabled={sharing}
              title={shareTitle}
              className={`${EXPORT_BTN} border border-neutral-400 hover:bg-neutral-100 disabled:opacity-60`}
            >
              {sharing ? 'Sharing…' : 'Share'}
            </button>
          </div>
          <div className="flex flex-wrap items-stretch gap-3">
            <input
              aria-label="Save quote as"
              value={saveName}
              placeholder="e.g. Red Sea worktop"
              className={inputClass}
              onChange={(e) => setSaveName(e.target.value)}
            />
            <button
              type="button"
              onClick={onSaveQuote}
              className="whitespace-nowrap rounded border border-gold px-3 text-sm font-medium"
              style={{ minHeight: '2.75rem' }}
            >
              Save quote
            </button>
          </div>
        </div>
      </div>

      <section
        aria-label="PDF preview"
        className={
          fullscreen
            ? 'fixed inset-0 z-50 overflow-hidden bg-white'
            : 'relative h-[60svh] min-h-[420px] overflow-hidden rounded border border-neutral-300 sm:h-[70svh]'
        }
      >
        {/* Full-screen phones get the export controls overlaid so they never scroll away. */}
        {fullscreen && (
          <div className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center gap-3 border-b border-neutral-200 bg-white/95 px-3 py-2 backdrop-blur">
            <button type="button" onClick={onDownload} className={`${EXPORT_BTN} bg-black font-semibold text-white hover:bg-neutral-800`}>
              Download PDF
            </button>
            <button type="button" onClick={onPrint} className={`${EXPORT_BTN} border border-neutral-400 hover:bg-neutral-100`}>
              Print
            </button>
            <button type="button" onClick={onShare} disabled={sharing} title={shareTitle} className={`${EXPORT_BTN} border border-neutral-400 hover:bg-neutral-100 disabled:opacity-60`}>
              {sharing ? 'Sharing…' : 'Share'}
            </button>
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className={`${EXPORT_BTN} ml-auto border border-neutral-400 hover:bg-neutral-100`}
            >
              Exit full screen
            </button>
          </div>
        )}
        <div className={fullscreen ? 'h-full w-full pt-[3.5rem]' : 'h-full w-full'}>
          {/* The preview is the artefact itself — same element, same renderer. */}
          <PdfPreview input={input} />
        </div>
        {!fullscreen && (
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="absolute bottom-3 right-3 min-h-[2.75rem] rounded border border-neutral-400 bg-white/95 px-3 text-sm font-medium shadow-sm hover:bg-neutral-100"
          >
            Full screen
          </button>
        )}
      </section>
    </div>
  );
}
