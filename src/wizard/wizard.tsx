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
import type { Client, Closing, LineItem, QuoteDocument } from '@/domain/types';
import { logActivity } from './telemetry';
import {
  fetchClients,
  saveClient,
  removeClient,
  fetchSignoffs,
  saveSignoff,
  removeSignoff,
  type StoredClient,
  type StoredSignoff,
} from './library';

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
  const draftLogged = useRef(false); // one draft_saved event per wizard session (#10)
  const lastBlobUrl = useRef<string | null>(null);
  const [savedClients, setSavedClients] = useState<StoredClient[]>([]);
  const [savedSignoffs, setSavedSignoffs] = useState<StoredSignoff[]>([]);
  const [reuseNotice, setReuseNotice] = useState('');

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

  // Load the user's saved client & sign-off libraries once on mount (#11 slices 3-4).
  // Best-effort and session-checked inside each fetch, so anonymous/unconfigured runs skip
  // the requests and leave the pickers empty. Runs client-only (useEffect), never prerender.
  useEffect(() => {
    void fetchClients().then(setSavedClients);
    void fetchSignoffs().then(setSavedSignoffs);
  }, []);

  // Debounced autosave on every change once the doc is dirty (FR-6.1) — a pristine
  // blank wizard is never persisted, so it can't nag "Resume draft?" next visit.
  // The first persist of a session also logs a draft_saved event (#10), throttled
  // to once so autosave chatter doesn't spam the events table.
  const autosave = useMemo(
    () => debounce((s: { step: WizardStep; doc: QuoteDocument }) => {
      if (hydrated.current && dirty.current) {
        writeDraft(browserKV(), s.step, s.doc);
        if (!draftLogged.current) {
          draftLogged.current = true;
          void logActivity('draft_saved', { docKind: s.doc.template });
        }
      }
    }, 400),
    [],
  );
  useEffect(() => {
    if (resume !== 'found') autosave({ step: state.step, doc: state.doc });
  }, [state, resume, autosave]);

  const assets: PdfAssets = { headerMark: profile.logos.headerMark, footerMark: profile.logos.footerMark, headerBand: '/brand/header-band.jpg', footerStrip: '/brand/footer-strip.jpg', footerStripProforma: '/brand/footer-strip-proforma.png' };
  const input = useMemo(() => makeInput(state.doc, profile, assets), [state.doc, profile, assets.headerMark, assets.footerMark, assets.headerBand, assets.footerStrip, assets.footerStripProforma]);

  const autoSaveClient = async (client: Client): Promise<void> => {
    const name = client.name.trim();
    if (!name) return; // nothing to save (validateStep1 already gates a blank name)
    const ok = await saveClient(client);
    if (ok) {
      setSavedClients(await fetchClients());
      setReuseNotice(`Saved client “${name}”.`);
    }
  };

  const pickClient = (client: Client): void => {
    dispatch({ type: 'setClient', patch: { name: client.name, custId: client.custId, city: client.city, crNo: client.crNo } });
    dispatch({ type: 'setAddressLines', lines: client.addressLines });
    setReuseNotice(`Loaded “${client.name}”.`);
  };

  const removeSavedClient = (id: string): void => {
    void removeClient(id).then(async () => setSavedClients(await fetchClients()));
    setReuseNotice('Removed saved client.');
  };

  // Mirrors upsertSignoffBlock's store rule: a block with neither name nor email is never
  // saved, so we skip the round-trip (and the toast) for a default/empty closing.
  const autoSaveSignoff = async (block: Closing): Promise<void> => {
    const name = block.name.trim();
    const email = block.email.trim();
    if (!name && !email) return;
    const ok = await saveSignoff(block);
    if (ok) {
      setSavedSignoffs(await fetchSignoffs());
      setReuseNotice(`Saved sign-off block “${name || email}”.`);
    }
  };

  const pickSignoff = (block: Closing): void => {
    dispatch({ type: 'setClosing', patch: block });
    setReuseNotice(`Loaded sign-off block “${block.name || block.email}”.`);
  };

  const removeSavedSignoff = (id: string): void => {
    void removeSignoff(id).then(async () => setSavedSignoffs(await fetchSignoffs()));
    setReuseNotice('Removed saved sign-off block.');
  };

  const go = (step: WizardStep) => {
    setAttempted((a) => ({ ...a, [state.step]: true }));
    if (step > state.step && Object.keys(validateStep(state.step, state.doc)).length > 0) return; // block + show errors
    if (step > furthestAllowedStep(state.doc)) return;
    // #11 slice 3: advancing off Step 1 auto-saves the (deduped) client profile. Only on
    // forward nav past a validated step, so half-typed/invalid clients never pile up.
    if (state.step === 1 && step > 1) void autoSaveClient(state.doc.client);
    // #11 slice 4: same pattern off Step 3 for the (content-deduped) sign-off block. Step 3
    // has no validation gate, so the blank-block guard inside autoSaveSignoff does the filtering.
    if (state.step === 3 && step > 3) void autoSaveSignoff(state.doc.closing);
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
      // #10: a Download is the definitive "generated" event — it logs 'exported'
      // for the KPI tiles and persists the document row so #12 can re-render the
      // PDF on open. The payload is the FULL render input ({ doc, profile }) so the
      // re-render is deterministic regardless of the viewer's current device profile.
      void logActivity('exported', { docKind: state.doc.template });
      void logActivity('document_saved', { docKind: state.doc.template, payload: { doc: state.doc, profile } });
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
      void logActivity('exported', { docKind: state.doc.template }); // #10 KPI source
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
    void logActivity('snapshot_saved', { docKind: state.doc.template }); // #10 KPI source
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

      {/* #11 reuse toast: rendered above <main> so the auto-save-then-advance confirmation
          stays visible after navigation moves off Step 1 (success-only, so green). */}
      {reuseNotice && (
        <p role="status" className="mb-4 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
          {reuseNotice}
        </p>
      )}

      <main className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        {state.step === 1 && (
          <Step1Meta
            doc={state.doc}
            errors={errors}
            dispatch={dispatch}
            savedClients={savedClients}
            onPickClient={pickClient}
            onRemoveClient={removeSavedClient}
          />
        )}
        {state.step === 2 && <Step2Lines doc={state.doc} errors={errors} dispatch={dispatch} onAddLine={addLine} />}
        {state.step === 3 && (
          <Step3Terms
            doc={state.doc}
            dispatch={dispatch}
            savedSignoffs={savedSignoffs}
            onPickSignoff={pickSignoff}
            onRemoveSignoff={removeSavedSignoff}
          />
        )}
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
