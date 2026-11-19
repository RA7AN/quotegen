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
import { useSearchParams } from 'next/navigation';
import { Step1Meta } from './step1-meta';
import { Step2Lines } from './step2-lines';
import { Step3Terms } from './step3-terms';
import { Step4Review } from './step4-review';
import { ProfilePicker } from './profile-picker';
import { FloatingToast, FloatingToastStack } from './fields';
import {
  blockingStep,
  furthestAllowedStep,
  initialWizardState,
  proformaBankGaps,
  validateStep,
  wizardReducer,
  type FieldErrors,
} from './state';
import { WizardErrorBoundary } from './error-boundary';
import { registerFonts } from '@/pdf/theme';
import { buildElement, makeInput, filenameFor, renderToBlob } from '@/pdf/index';
import { canSharePdf, sharePdfFile } from './share';
import {
  browserKV,
  clearDraft,
  debounce,
  KEYS,
  loadBrandAssets,
  loadProfile,
  readDraft,
  readProfilePick,
  upsertQuote,
  writeDraft,
  writeProfilePick,
  type WizardStep,
} from '@/lib/storage';
import { assetsWithOverrides } from '@/domain/rehydrate';
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
  fetchDraft,
  persistDraft,
  fetchProfile,
  fetchProfiles,
  fetchProfileById,
  type ProfileAssetPair,
  type StoredClient,
  type StoredSignoff,
  type StoredProfileSummary,
} from './library';

// Browser font registration: bundled TTFs served from the /fonts folder (02 §5.5). Idempotent.
registerFonts((file) => `/fonts/${file}`);

const STEPS: ReadonlyArray<{ n: WizardStep; label: string; short: string }> = [
  { n: 1, label: 'Meta & client', short: 'Meta' },
  { n: 2, label: 'Line items & commercials', short: 'Items' },
  { n: 3, label: 'Terms & conditions', short: 'Terms' },
  { n: 4, label: 'Review & export', short: 'Review' },
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
  // #38: brand-mark overrides sourced from the server profile (null = not yet fetched /
  // anonymous, so the resolver falls back to the device-local assets slot).
  const [serverAssets, setServerAssets] = useState<ProfileAssetPair | null>(null);
  // #31 part 1: the saved-profile library (for the per-quote picker) + the id of the profile
  // chosen to render THIS quote (null = the account default). The pick persists in its own
  // localStorage slot so a reload restores a deliberate choice; the export still snapshots the
  // full chosen profile, so past artifacts are unaffected.
  const [savedProfiles, setSavedProfiles] = useState<StoredProfileSummary[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  // Multi-drafts: identity of the SERVER draft this session loads/created (null =
  // not saved yet). "Save draft" creates on first click, refreshes in place after.
  const [draftId, setDraftId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  // Web Share availability is a per-device browser capability — probe once on mount
  // (false during SSR/prerender, so the fallback download path is the default).
  const [nativeShare, setNativeShare] = useState(false);
  const [sharing, setSharing] = useState(false);
  // #50: a scroll container + a "N fields need attention" count so an invalid Continue on a
  // 2 000 px step 1 can bring the (off-screen) error into view and focus the first bad field.
  const mainRef = useRef<HTMLElement>(null);
  const [errorCount, setErrorCount] = useState(0);
  const draftParam = useSearchParams().get('draft');

  // After React commits the newly-revealed inline errors, centre + focus the first invalid
  // control. Focus also raises the keyboard, which is exactly where a phone user needs to be.
  const revealFirstError = () => {
    requestAnimationFrame(() => {
      const root = mainRef.current;
      if (!root) return;
      const bad = root.querySelector<HTMLElement>('[aria-invalid="true"]');
      if (bad) {
        bad.scrollIntoView({ block: 'center' });
        bad.focus({ preventScroll: true });
      }
    });
  };

  const dispatch = (a: Parameters<typeof dispatchRaw>[0], opts?: { silent?: boolean }) => {
    // Programmatic seed dispatches (e.g. the segmented doc-number default on mount)
    // pass silent:true so they don't dirty the wizard and cause autosave to write a
    // "Resume draft?" the user never asked for. Real user edits use the default path.
    if (!opts?.silent) dirty.current = true;
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
  // #38: also adopt the server-backed active profile + brand marks when present — the
  // profile becomes the render source of truth for the session; anonymous runs keep the
  // device-local profile loaded above (fetchProfile resolves to null, so this is a no-op).
  useEffect(() => {
    void fetchClients().then(setSavedClients);
    void fetchSignoffs().then(setSavedSignoffs);
    void fetchProfiles().then(setSavedProfiles);
    void (async () => {
      // #31 part 1: a per-quote pick wins over the account default when its row still
      // resolves; a stale id (deleted row) clears itself and falls back. Both reads are
      // session-checked, so an anonymous run resolves null and keeps the device-local profile
      // loaded on mount — fetchProfile makes zero calls, exactly as before.
      const pickId = readProfilePick(browserKV());
      if (pickId) {
        const chosen = await fetchProfileById(pickId);
        if (chosen) {
          setProfile(chosen.profile);
          setServerAssets(chosen.assets);
          setProfileId(chosen.id);
          return;
        }
        writeProfilePick(browserKV(), null);
      }
      const sp = await fetchProfile();
      if (sp) {
        setProfile(sp.profile);
        setServerAssets(sp.assets);
      }
    })();
    setNativeShare(canSharePdf());
  }, []);

  // /new?draft=<id> — open a saved server draft (multi-drafts slice). One-shot on
  // mount: hydrate the reducer with the stored step + doc, adopt the id so re-saving
  // refreshes the same row, and stand down the local resume banner so the two
  // restore paths can't fight. A missing/foreign/undecodable draft degrades to a
  // fresh wizard plus a toast, never a crash (EC-11 discipline).
  useEffect(() => {
    if (!draftParam) return;
    let alive = true;
    void (async () => {
      const loaded = await fetchDraft(draftParam);
      if (!alive) return;
      if (loaded) {
        dispatch({ type: 'hydrate', step: loaded.step, doc: loaded.doc });
        hydrated.current = true;
        setDraftId(loaded.id);
        setResume('none');
        setReuseNotice(`Opened draft “${loaded.name}”.`);
      } else {
        setResume('none');
        setStatus('That draft could not be found — started a fresh wizard.');
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot per deep link
  }, [draftParam]);

  // Auto-dismiss reuse/success toasts after 5 s.
  useEffect(() => {
    if (!reuseNotice) return;
    const t = setTimeout(() => setReuseNotice(''), 5_000);
    return () => clearTimeout(t);
  }, [reuseNotice]);

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

  // #5: resolve brand marks through the shared resolver so a Settings-uploaded override
  // replaces the bundled crop without touching profile/draft keys. #38: prefer the
  // server-sourced overrides once fetched; before that (anonymous / not yet loaded) fall
  // back to the device-local assets slot so the offline/anonymous path is unchanged.
  const assets: PdfAssets = useMemo(
    () => assetsWithOverrides(profile, serverAssets ?? loadBrandAssets(browserKV())),
    [profile, serverAssets],
  );
  // #6: blank proforma bank fields render as omitted ACCOUNT DETAILS rows —
  // surface them as a Step-3 advisory (proforma template only, never blocking).
  const bankGaps = state.doc.template === 'proforma' ? proformaBankGaps(profile) : [];
  const input = useMemo(() => makeInput(state.doc, profile, assets), [state.doc, profile, assets]);

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

  // #31 part 1: render THIS quote from another saved library profile without changing the
  // account default. Pull the full row, swap the render source + marks, and remember the pick.
  const useProfileForQuote = async (id: string): Promise<void> => {
    const chosen = await fetchProfileById(id);
    if (!chosen) {
      setStatus('That saved profile could not be loaded.');
      return;
    }
    setProfile(chosen.profile);
    setServerAssets(chosen.assets);
    setProfileId(chosen.id);
    writeProfilePick(browserKV(), chosen.id);
    setReuseNotice(`Rendering this quote with “${chosen.name || 'the selected profile'}”.`);
  };

  const useDefaultProfile = async (): Promise<void> => {
    writeProfilePick(browserKV(), null);
    setProfileId(null);
    const sp = await fetchProfile();
    if (sp) {
      setProfile(sp.profile);
      setServerAssets(sp.assets);
    }
    setReuseNotice('Back to your account default profile.');
  };

  const go = (step: WizardStep) => {
    // Backwards is ALWAYS allowed. furthestAllowedStep revalidates the whole doc,
    // so gating a retreat (e.g. Step 3 → 2) with it once trapped users on a middle
    // step whenever an earlier step regressed — a draft opened under older rules
    // failing the newer 30-day validity check had no way out and no error shown.
    if (step < state.step) {
      setErrorCount(0);
      dispatch({ type: 'goto', step });
      return;
    }
    setAttempted((a) => ({ ...a, [state.step]: true }));
    if (step > state.step) {
      const currentErrors = validateStep(state.step, state.doc);
      if (Object.keys(currentErrors).length > 0) {
        // #50: block, surface inline errors, and jump the viewport to the first one — the
        // errors used to render far above the tapped Continue button, so the tap looked dead.
        setErrorCount(Object.keys(currentErrors).length);
        revealFirstError();
        return;
      }
    }
    if (step > state.step) {
      // Blocked by a problem on an EARLIER step: bounce there with its errors
      // surfaced and a fleeting toast, instead of swallowing the click silently.
      const blocker = blockingStep(state.doc, step);
      if (blocker !== null) {
        setAttempted((a) => ({ ...a, [blocker]: true }));
        const blockerErrors = validateStep(blocker, state.doc);
        setErrorCount(Object.keys(blockerErrors).length);
        dispatch({ type: 'goto', step: blocker });
        setReuseNotice(`Step ${blocker} needs fixing before you can continue — see the highlighted fields.`);
        revealFirstError();
        return;
      }
    }
    setErrorCount(0);
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

  // Anchor-click save for an in-memory blob. One blob URL at a time — each new
  // export revokes the previous so repeated clicks don't leak object URLs.
  const saveToDisk = (blob: Blob, filename: string): void => {
    if (lastBlobUrl.current) URL.revokeObjectURL(lastBlobUrl.current);
    lastBlobUrl.current = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = lastBlobUrl.current;
    a.download = filename;
    a.click();
  };

  const download = async (): Promise<void> => {
    if (!canReachReview) {
      setStatus('Complete the earlier steps first — required fields are still missing.');
      return;
    }
    setStatus('Rendering PDF…');
    try {
      const { blob, filename } = await renderToBlob(input);
      saveToDisk(blob, filename);
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
    // #50: `window.open` must be called synchronously inside the click or the browser drops it
    // as a popup. It used to run AFTER the async render, so on a phone (where the user
    // activation expires during renderToBlob) Print silently did nothing. Grab the tab first,
    // then point it at the blob once it resolves; fall back to a download if it was blocked.
    const tab = typeof window !== 'undefined' ? window.open('', '_blank') : null;
    try {
      const { blob, filename } = await renderToBlob(input);
      if (lastBlobUrl.current) URL.revokeObjectURL(lastBlobUrl.current);
      lastBlobUrl.current = URL.createObjectURL(blob);
      if (tab) {
        tab.location.href = lastBlobUrl.current;
        setStatus('PDF opened in a new tab — use its print button.');
      } else {
        saveToDisk(blob, filename);
        setStatus('The print tab was blocked — downloaded the PDF instead; open it to print.');
      }
      void logActivity('exported', { docKind: state.doc.template }); // #10 KPI source
    } catch (err) {
      if (tab) tab.close();
      setStatus(`Render failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Share the rendered PDF through the device's native sheet (mail/social apps,
  // real attachment). Where the browser can't share files (most desktop), the
  // click degrades to a Download with the same event logging, so the user can
  // still attach the file by hand. Dismissing the sheet is not an error.
  const share = async (): Promise<void> => {
    if (!canReachReview) {
      setStatus('Complete the earlier steps first — required fields are still missing.');
      return;
    }
    setSharing(true);
    try {
      const { blob, filename } = await renderToBlob(input);
      const kind = state.doc.template === 'proforma' ? 'Proforma invoice' : 'Quotation';
      const res = await sharePdfFile(blob, filename, `${kind} ${state.doc.meta.docNo}`.trim(), `${kind} from ${profile.legalNameEn}.`);
      if (res.outcome === 'shared') {
        setStatus(`Shared ${filename}`);
        void logActivity('exported', { docKind: state.doc.template }); // #10 KPI source
      } else if (res.outcome === 'cancelled') {
        setStatus('Share dismissed — the PDF was not sent.');
      } else if (res.outcome === 'unsupported') {
        saveToDisk(blob, filename);
        setStatus('Sharing isn’t available in this browser — downloaded instead; attach the PDF in your mail or chat app.');
        void logActivity('exported', { docKind: state.doc.template });
        void logActivity('document_saved', { docKind: state.doc.template, payload: { doc: state.doc, profile } });
      } else {
        setStatus(`Share failed: ${res.error ?? 'unknown error'}`);
      }
    } catch (err) {
      setStatus(`Render failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSharing(false);
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

  // Explicit multi-draft save (multi-drafts slice): one click creates a titled row
  // server-side; while a loaded/adopted draft is open, re-clicking refreshes the
  // SAME row. Title is derived server-side from the doc — no naming prompt (AC-9).
  const saveDraftNow = async (): Promise<void> => {
    setSavingDraft(true);
    try {
      const res = await persistDraft({ id: draftId, step: state.step, doc: state.doc });
      if (res) {
        setDraftId(res.id);
        setReuseNotice(res.name ? `Draft “${res.name}” saved.` : 'Draft saved.');
      } else {
        setStatus('Could not save the draft — sign in and try again.');
      }
    } finally {
      setSavingDraft(false);
    }
  };

  // Last-resort recovery from a render crash (error boundary): reload /new whole.
  // The localStorage draft is left untouched and a fresh wizard starts pristine
  // (dirty=false until a real edit), so the Resume banner offers the work back
  // instead of a blank form overwriting it.
  const hardRecover = (): void => {
    window.location.assign('/new');
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      <nav aria-label="Wizard progress" className="mb-3">
        {/* #50: four full-label chips wrapped to 3–4 lines (92 px of chrome on every step, 13 %
            of the viewport). Phones get one non-wrapping row of short labels at ≤48 px; the
            accessible name keeps the full label so a screen reader still hears "Line items &
            commercials". The wizard.test contract relies on that name. */}
        <ol className="flex flex-nowrap items-center gap-2 overflow-x-auto">
          {STEPS.map((s) => {
            const statusLabel = s.n < state.step ? 'done' : s.n === state.step ? 'active' : 'pending';
            const allowed = s.n <= furthestAllowedStep(state.doc) || s.n <= state.step;
            return (
              <li key={s.n} className="shrink-0">
                <button
                  type="button"
                  aria-current={statusLabel === 'active' ? 'step' : undefined}
                  aria-label={`${s.n}. ${s.label}`}
                  disabled={!allowed}
                  title={allowed ? s.label : 'Finish the required fields on this step to unlock later steps'}
                  onClick={() => go(s.n)}
                  className={
                    statusLabel === 'active'
                      ? 'min-h-[2.75rem] whitespace-nowrap rounded-md bg-black px-3 text-sm font-medium text-white'
                      : statusLabel === 'done'
                        ? 'min-h-[2.75rem] whitespace-nowrap rounded-md px-3 text-sm font-medium text-black hover:bg-neutral-100 disabled:opacity-40'
                        : 'min-h-[2.75rem] whitespace-nowrap rounded-md px-3 text-sm text-muted hover:bg-neutral-100 disabled:opacity-40'
                  }
                >
                  {s.n}. {s.short}
                </button>
              </li>
            );
          })}
        </ol>
        {furthestAllowedStep(state.doc) < 4 && (
          <p className="mt-1 text-xs text-muted">Locked steps unlock once the required fields on this step are valid.</p>
        )}
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
              className="inline-flex min-h-[2.75rem] items-center rounded bg-black px-4 text-sm font-medium text-white"
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
              className="inline-flex min-h-[2.75rem] items-center rounded border border-neutral-400 px-4 text-sm"
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

      <main ref={mainRef} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <WizardErrorBoundary onReset={hardRecover}>
        {(state.step === 1 || state.step === 4) && (
          <div className="mb-4">
            <ProfilePicker
              profiles={savedProfiles}
              currentId={profileId}
              onUse={(id) => void useProfileForQuote(id)}
              onResetToDefault={() => void useDefaultProfile()}
            />
          </div>
        )}
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
            bankGaps={bankGaps}
          />
        )}
        {state.step === 4 && (
          <Step4Review
            input={input}
            onDownload={() => void download()}
            onPrint={() => void print()}
            onShare={() => void share()}
            sharing={sharing}
            nativeShare={nativeShare}
            onSaveQuote={saveQuote}
            saveName={saveName}
            setSaveName={setSaveName}
          />
        )}
        </WizardErrorBoundary>
      </main>

      {errorCount > 0 && (
        <p role="alert" className="mt-4 text-center text-sm font-medium text-red-700">
          {errorCount} {errorCount === 1 ? 'field needs' : 'fields need'} attention — the first one is
          highlighted above.
        </p>
      )}
      <p className="mt-3 break-words text-center text-xs text-muted">
        {state.step === 4
          ? `Filename will be: ${filenameFor(state.doc)}`
          : draftId
            ? 'Autosaved locally; draft row updates when you save'
            : 'Autosaved locally as you type'}
      </p>

      {/* #50: Back / Save draft / Continue used to sit at doc-y ≈ 2 000 on a 2 096 px step 1 —
          a static target that scrolled off-screen, so the primary action vanished behind the
          form. The bar now sticks just above the fixed tab bar (+ safe area) and stays put at
          every scroll position of every step (AC-4). */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
        <span className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => go(state.step === 1 ? 1 : ((state.step - 1) as WizardStep))}
            disabled={state.step === 1}
            className="min-h-[2.75rem] rounded border border-neutral-400 px-4 text-sm disabled:opacity-40"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={() => void saveDraftNow()}
            disabled={savingDraft}
            title="Save this form to your drafts and resume it later from Drafts"
            className="min-h-[2.75rem] rounded border border-neutral-400 px-4 text-sm hover:bg-neutral-100 disabled:opacity-40"
          >
            {savingDraft ? 'Saving…' : draftId ? 'Update draft' : 'Save draft'}
          </button>
        </span>
        {state.step < 4 && (
          <button
            type="button"
            onClick={() => go((state.step + 1) as WizardStep)}
            className="min-h-[2.75rem] shrink-0 rounded bg-black px-4 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            Continue →
          </button>
        )}
      </div>

      {/* Floating notifications — always visible at bottom-right regardless of scroll position. */}
      {(status || reuseNotice) && (
        <FloatingToastStack>
          {status && (
            <FloatingToast message={status} variant="info" onDismiss={() => setStatus('')} />
          )}
          {reuseNotice && (
            <FloatingToast message={reuseNotice} variant="success" onDismiss={() => setReuseNotice('')} />
          )}
        </FloatingToastStack>
      )}
    </div>
  );
}
