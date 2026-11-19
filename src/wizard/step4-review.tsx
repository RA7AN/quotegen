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
 */

import { memo, useMemo } from 'react';
import { PDFViewer } from '@react-pdf/renderer';
import { buildElement } from '@/pdf/index';
import type { PdfInput } from '@/pdf/input';

const PdfPreview = memo(function PdfPreview({ input }: { input: PdfInput }) {
  const doc = useMemo(() => buildElement(input), [input]);
  return (
    <PDFViewer width="100%" height="900" showToolbar>
      {doc}
    </PDFViewer>
  );
});

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
  return (
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      <div className="space-y-4">
        <div className="space-y-2 rounded border border-neutral-200 bg-panel p-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Export</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onDownload}
              className="rounded bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              Download PDF
            </button>
            <button
              type="button"
              onClick={onPrint}
              className="rounded border border-neutral-400 px-4 py-2 text-sm font-medium hover:bg-neutral-100"
            >
              Print
            </button>
            <button
              type="button"
              onClick={onShare}
              disabled={sharing}
              title={
                nativeShare
                  ? 'Share the PDF as an attachment via mail or social apps on this device'
                  : 'This browser has no share sheet — downloads the PDF so you can attach it yourself'
              }
              className="rounded border border-neutral-400 px-4 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-60"
            >
              {sharing ? 'Sharing…' : 'Share'}
            </button>
          </div>
          <div className="flex gap-2">
            <input
              aria-label="Save quote as"
              value={saveName}
              placeholder="e.g. Red Sea worktop"
              className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
              onChange={(e) => setSaveName(e.target.value)}
            />
            <button
              type="button"
              onClick={onSaveQuote}
              className="whitespace-nowrap rounded border border-gold px-3 py-1.5 text-sm font-medium"
            >
              Save quote
            </button>
          </div>
        </div>
      </div>

      <section aria-label="PDF preview" className="min-h-[640px] overflow-hidden rounded border border-neutral-300">
        {/* The preview is the artefact itself — same element, same renderer. */}
        <PdfPreview input={input} />
      </section>
    </div>
  );
}
