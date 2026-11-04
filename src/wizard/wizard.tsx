/**
 * wizard/wizard.tsx — the 3-step shell (FR-2, mirrors the reference generator-wizard).
 *
 * - Steps: useState-style indicator with `aria-current="step"` (AC-7 / NFR-4).
 * - Gating: Continue validates the step and shows inline field errors (AC-9) — never
 *   alert()/confirm(). Step chips jump only as far as `furthestAllowedStep`.
 * - Draft: debounced autosave to localStorage (FR-6.1); on reload a "Resume draft?"
 *   banner offers restore or discard (HP-4 / AC-12); an unreadable draft degrades to a
 *   blank wizard plus a notice, never a white screen (EC-11).
 * - Export: reuses the Phase-2 path — makeInput + renderToBlob from src/pdf/index.tsx;
 *   Print opens the same blob in the browser viewer (02 §5.4).
 */

'use client';

import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Step1Meta } from './step1-meta';
import { Step2Lines } from './step2-lines';
import { Step3Terms } from './step3-terms';
import { Step4Review } from './step4-review';
import {
  furthestAllowedStep,
  initialWizardState,
  validateStep,
  wizardReducer,
  type FieldErrors,
} from './state';
import { registerFonts } from '@/pdf/theme';
import { buildElement, makeInput, filenameFor, renderToBlob } from '@/pdf/index';
import {
  browserKV,
  clearDraft,
  debounce,
  KEYS,
  loadProfile,
  readDraft,
  upsertQuote,
  writeDraft,
  type WizardStep,
} from '@/lib/storage';
import type { PdfAssets } from '@/pdf/primitives';
import type { LineItem, QuoteDocument } from '@/domain/types';

// Browser font registration: bundled TTFs served from /fonts/* (02 §5.5). Idempotent.
registerFonts((file) => `/fonts/${file}`);

const STEPS: ReadonlyArray<{ n: WizardStep; label: string }> = [
  { n: 1, label: 'Meta & client' },
  { n: 2, label: 'Line items & commercials' },
  { n: 3, label: 'Terms & conditions' },
  { n: 4, label: 'Review & export' },
];

type ResumeState = 'checking' | 'none' | 'found' | 'corrupt';

export function Wizard() {
  const [state, dispatchRaw] = useReducer(wizardReducer, undefined, initialWizardState);
  const [profile, setProfile] = useState(loadProfile(browserKV()));
  const [resume, setResume] = useState<ResumeState>('checking');
  const [draftRef] = useState(() => readDraft(browserKV()));
  const [attempted, setAttempted] = useState<Record<WizardStep, boolean>>({ 1: false, 2: false, 3: false, 4: false });
  const [status, setStatus] = useState('');
  const [saveName, setSaveName] = useState('');
  const hydrated = useRef(false);
  const dirty = useRef(false); // autosave only once the user (or a resume) has touched the doc
  const lastBlobUrl = useRef<string | null>(null);

  const dispatch = (a: Parameters<typeof dispatchRaw>[0]) => {
    dirty.current = true;
    dispatchRaw(a);
  };

  const errors: FieldErrors = attempted[state.step] ? validateStep(state.step, state.doc) : {};
  const canReachReview = furthestAllowedStep(state.doc) >= 4;

  // One-time draft probe (client-only; static export prerenders with 'checking').
  useEffect(() => {
    const kv = browserKV();
    if (draftRef) setResume('found');
    else if (kv.getItem(KEYS.draft) !== null) setResume('corrupt'); // EC-11: present but unreadable
    else setResume('none');
    setProfile(loadProfile(kv));
    hydrated.current = true;
  }, [draftRef]);

  // Debounced autosave on every change once the doc is dirty (FR-6.1) — a pristine
  // blank wizard is never persisted, so it can't nag "Resume draft?" next visit.
  const autosave = useMemo(
    () => debounce((s: { step: WizardStep; doc: QuoteDocument }) => {
      if (hydrated.current && dirty.current) writeDraft(browserKV(), s.step, s.doc);
    }, 400),
    [],
  );
  useEffect(() => {
    if (resume !== 'found') autosave({ step: state.step, doc: state.doc });
  }, [state, resume, autosave]);

  const assets: PdfAssets = { headerMark: profile.logos.headerMark, footerMark: profile.logos.footerMark, headerBand: '/brand/header-band.jpg', footerStrip: '/brand/footer-strip.jpg', footerStripProforma: '/brand/footer-strip-proforma.png' };
  const input = useMemo(() => makeInput(state.doc, profile, assets), [state.doc, profile, assets.headerMark, assets.footerMark, assets.headerBand, assets.footerStrip, assets.footerStripProforma]);

  const go = (step: WizardStep) => {
    setAttempted((a) => ({ ...a, [state.step]: true }));
    if (step > state.step && Object.keys(validateStep(state.step, state.doc)).length > 0) return; // block + show errors
    if (step > furthestAllowedStep(state.doc)) return;
    dispatch({ type: 'goto', step });
  };

  const addLine = () => {
    const line: Omit<LineItem, 'id'> = { description: '', uom: 'u', qtyHundredths: 100, unitPriceHalalas: 0, pricing: 'rated' };
    dispatch({ type: 'addLine', id: crypto.randomUUID(), line });
  };

  const download = async (): Promise<void> => {
    if (!canReachReview) {
      setStatus('Complete the earlier steps first — required fields are still missing.');
      return;
    }
    setStatus('Rendering PDF…');
    try {
      const { blob, filename } = await renderToBlob(input);
      if (lastBlobUrl.current) URL.revokeObjectURL(lastBlobUrl.current);
      lastBlobUrl.current = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = lastBlobUrl.current;
      a.download = filename;
      a.click();
      setStatus(`Downloaded ${filename}`);
    } catch (err) {
      setStatus(`Render failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Print path per 02 §5.4: no parallel HTML print stylesheet — open the real PDF in
  // the browser viewer and let its toolbar print.
  const print = async (): Promise<void> => {
    if (!canReachReview) {
      setStatus('Complete the earlier steps first — required fields are still missing.');
      return;
    }
    setStatus('Opening PDF for print…');
    try {
      const { blob } = await renderToBlob(input);
      if (lastBlobUrl.current) URL.revokeObjectURL(lastBlobUrl.current);
      lastBlobUrl.current = URL.createObjectURL(blob);
      window.open(lastBlobUrl.current, '_blank', 'noopener');
      setStatus('PDF opened in a new tab — use its print button.');
    } catch (err) {
      setStatus(`Render failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const saveQuote = () => {
    const name = saveName.trim() || state.doc.meta.docNo;
    if (!name) {
      setStatus('Give the saved quote a name (or fill the document number first).');
      return;
    }
    upsertQuote(browserKV(), {
      id: crypto.randomUUID(),
      name,
      savedAtISO: new Date().toISOString(),
      doc: state.doc,
    });
    setSaveName('');
    setStatus(`Saved “${name}” — find it under Quotes.`);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <nav aria-label="Wizard progress" className="mb-5">
        <ol className="flex flex-wrap items-center gap-2">
          {STEPS.map((s) => {
            const statusLabel = s.n < state.step ? 'done' : s.n === state.step ? 'active' : 'pending';
            const allowed = s.n <= furthestAllowedStep(state.doc) || s.n <= state.step;
            return (
              <li key={s.n} className="flex flex-1 items-center gap-2">
                <button
                  type="button"
                  aria-current={statusLabel === 'active' ? 'step' : undefined}
                  disabled={!allowed}
                  onClick={() => go(s.n)}
                  className={
                    statusLabel === 'active'
                      ? 'rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white'
                      : statusLabel === 'done'
                        ? 'rounded-md px-3 py-1.5 text-sm font-medium text-black hover:bg-neutral-100 disabled:opacity-40'
                        : 'rounded-md px-3 py-1.5 text-sm text-muted hover:bg-neutral-100 disabled:opacity-40'
                  }
                >
                  {s.n}. {s.label}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {resume === 'found' && draftRef && (
        <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded border border-gold bg-yellow-50 px-3 py-2 text-sm">
          <span>
            Resume draft? — step {draftRef.step} of the {draftRef.doc.template === 'proforma' ? 'proforma' : 'quotation'}
            {' '}{draftRef.doc.meta.docNo ? `“${draftRef.doc.meta.docNo}”` : '(no document number)'}.
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              className="rounded bg-black px-3 py-1 text-xs font-medium text-white"
              onClick={() => {
                dispatch({ type: 'hydrate', step: draftRef.step, doc: draftRef.doc });
                hydrated.current = true;
                setResume('none');
              }}
            >
              Resume
            </button>
            <button
              type="button"
              className="rounded border border-neutral-400 px-3 py-1 text-xs"
              onClick={() => {
                clearDraft(browserKV());
                dispatch({ type: 'reset' });
                hydrated.current = true;
                setResume('none');
              }}
            >
              Start fresh
            </button>
          </span>
        </div>
      )}
      {resume === 'corrupt' && (
        <div role="alert" className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm">
          A saved draft could not be read (it may be from an older version) — started a fresh wizard.
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => {
              clearDraft(browserKV());
              setResume('none');
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      <main className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        {state.step === 1 && <Step1Meta doc={state.doc} errors={errors} dispatch={dispatch} />}
        {state.step === 2 && <Step2Lines doc={state.doc} errors={errors} dispatch={dispatch} onAddLine={addLine} />}
        {state.step === 3 && <Step3Terms doc={state.doc} dispatch={dispatch} />}
        {state.step === 4 && (
          <Step4Review
            input={input}
            status={status}
            onDownload={() => void download()}
            onPrint={() => void print()}
            onSaveQuote={saveQuote}
            saveName={saveName}
            setSaveName={setSaveName}
          />
        )}
      </main>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => go(state.step === 1 ? 1 : ((state.step - 1) as WizardStep))}
          disabled={state.step === 1}
          className="rounded border border-neutral-400 px-4 py-2 text-sm disabled:opacity-40"
        >
          ← Back
        </button>
        <span className="text-xs text-muted">
          {state.step === 4
            ? `Filename will be: ${filenameFor(state.doc)}`
            : 'Autosaved locally as you type'}
        </span>
        {state.step < 4 && (
          <button
            type="button"
            onClick={() => go((state.step + 1) as WizardStep)}
            className="rounded bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            Continue →
          </button>
        )}
      </div>
    </div>
  );
}
