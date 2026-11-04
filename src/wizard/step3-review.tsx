/**
 * wizard/step3-review.tsx — Step 3: review & export (FR-2.1 step 3, FR-7).
 *
 * The preview IS the PDF (`<PDFViewer>` over the exact element `renderToBlob` prints —
 * 02 §1 "single source of truth", no HTML/PDF divergence). Free-text prose (terms
 * clauses + sign-off block) stays click-to-edit here; everything numeric is fixed by
 * steps 1–2 and the engine. Download/Print/Save handlers are owned by the wizard.
 */

import { PDFViewer } from '@react-pdf/renderer';
import { LinesTextArea, TextField } from './fields';
import { buildElement } from '@/pdf/index';
import type { PdfInput } from '@/pdf/input';
import type { WizardAction } from './state';

export function Step3Review({
  input,
  dispatch,
  status,
  onDownload,
  onPrint,
  onSaveQuote,
  saveName,
  setSaveName,
}: {
  input: PdfInput;
  dispatch: (a: WizardAction) => void;
  status: string;
  onDownload: () => void;
  onPrint: () => void;
  onSaveQuote: () => void;
  saveName: string;
  setSaveName: (v: string) => void;
}) {
  const { doc } = input;
  return (
    <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
      <div className="space-y-4">
        <LinesTextArea
          label="Terms & Conditions clauses"
          rows={7}
          lines={doc.terms.clauses}
          onChange={(clauses) => dispatch({ type: 'setTermsClauses', clauses })}
        />
        <div className="space-y-3 rounded border border-neutral-200 p-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Sign-off block</h3>
          <TextField label="Sign-off line" value={doc.closing.signoff} onChange={(v) => dispatch({ type: 'setClosing', patch: { signoff: v } })} />
          <TextField label="Name" value={doc.closing.name} onChange={(v) => dispatch({ type: 'setClosing', patch: { name: v } })} />
          <TextField label="Organisation" value={doc.closing.org} onChange={(v) => dispatch({ type: 'setClosing', patch: { org: v } })} />
          <TextField label="Mobile" value={doc.closing.mobile} onChange={(v) => dispatch({ type: 'setClosing', patch: { mobile: v } })} />
          <TextField label="Email" value={doc.closing.email} onChange={(v) => dispatch({ type: 'setClosing', patch: { email: v } })} />
        </div>

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
          {status && <p role="status" aria-live="polite" className="text-xs text-muted">{status}</p>}
        </div>
      </div>

      <section aria-label="PDF preview" className="min-h-[640px] overflow-hidden rounded border border-neutral-300">
        {/* The preview is the artefact itself — same element, same renderer. */}
        <PDFViewer width="100%" height="900" showToolbar>
          {buildElement(input)}
        </PDFViewer>
      </section>
    </div>
  );
}
