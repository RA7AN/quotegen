/**
 * wizard/step1-meta.tsx — Step 1: Meta & client (FR-2.1 step 1).
 *
 * Template choice (FR-1.3), document number (split into segmented row: prefix /
 * project / year / seq on Quotation; seq / suffix on Proforma), dates, client block,
 * attn + subject.
 *
 * Doc-number segmented row: `meta.docNo` stays the single authoritative string (schema
 * unchanged, filenames + PDFs keep reading it). Segments are local UI state kept in
 * sync with docNo via parse/compose helpers from lib/doc-number.ts; every edit
 * composes a new docNo and dispatches `setMeta`. When the required parts are still
 * blank, compose throws and we hold docNo at the last valid value so we never write a
 * malformed string. On mount with a blank docNo (new wizard / cleared draft) we seed
 * defaults so preview + filename are populated from the first render.
 *
 * Mobile: row stacks 1 column below `sm`, 2 columns on tablets, 4 columns on `lg+`
 * (standard responsive grid; +/- tap targets are 44 px via NumberStepper).
 *
 * Errors are the inline field-level messages from state.ts validation (AC-9 / AC-24).
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { TextField, RichInput, NumberStepper, PrefixCombobox, SectionCard } from './fields';
import { ClientPicker } from './client-picker';
import type { FieldErrors } from './state';
import type { WizardAction } from './state';
import type { Client, QuoteDocument } from '@/domain/types';
import type { StoredClient } from './library';
import { fetchNextSeq } from './library';
import {
  parseQuotationDocNo,
  parseProformaDocNo,
  composeQuotationDocNo,
  composeProformaDocNo,
  defaultQuotationSegments,
  defaultProformaSegments,
  type QuotationSegments,
  type ProformaSegments,
} from '@/lib/doc-number';

/** Fixed prefix options for the Quotation dropdown. "Custom…" is added by the widget. */
const QUOTATION_PREFIX_OPTIONS = ['ENCM-'] as const;

/** Salutation options shown in the attention-row dropdown. "Custom…" is added inline. */
const SALUTATION_OPTIONS = ['Mr', 'Ms', 'Mrs', 'Dr'] as const;

/**
 * Splits an existing attn string (e.g. "Mr Mithun") into a recognised title + a
 * remaining name. Returns `{ title: '', name: full }` when the title is unknown,
 * which leaves the salutation select on "—" (no title) in the UI.
 */
function parseAttnTitle(attn: string): { title: string; name: string } {
  const m = /^(Mr|Mrs|Ms|Dr)\.?\s+(.+)/i.exec(attn.trim());
  return m ? { title: m[1]!, name: m[2]! } : { title: '', name: attn };
}

/** Joins title + person back into the authoritative meta.attn string. */
function composeAttn(title: string, name: string): string {
  if (!title) return name;
  return `${title} ${name}`;
}

/** 2-digit year string for the current calendar year (used as blank-doc default). */
function currentYearYY(): string {
  return String(new Date().getFullYear()).slice(-2);
}

function tryCompose(segments: QuotationSegments | ProformaSegments, template: 'quotation' | 'proforma'): string | null {
  try {
    return template === 'quotation'
      ? composeQuotationDocNo(segments as QuotationSegments)
      : composeProformaDocNo(segments as ProformaSegments);
  } catch {
    return null;
  }
}

function seedSegments(
  template: 'quotation' | 'proforma',
  docNo: string,
): QuotationSegments | ProformaSegments {
  if (template === 'quotation') {
    return parseQuotationDocNo(docNo) ?? defaultQuotationSegments(currentYearYY());
  }
  return parseProformaDocNo(docNo) ?? defaultProformaSegments();
}

/**
 * Segmented document-number row. Controlled by local state so partial/blank edits stay
 * visible to the user (typing does not "snap back" to the parsed docNo). Syncs from
 * external docNo changes (draft resume, template flip) via the effect below.
 */
function DocNumberRow({
  doc,
  errors,
  dispatch,
}: {
  doc: QuoteDocument;
  errors: FieldErrors;
  dispatch: (a: WizardAction, opts?: { silent?: boolean }) => void;
}) {
  const template = doc.template;
  const docNo = doc.meta.docNo;
  const [segments, setSegments] = useState(() => seedSegments(template, docNo));
  // Mirror of `segments` for reading inside the effect without making it a dep —
  // the effect must not re-run on every keystroke or it would wipe transient input.
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  // True once the user has focused/typed in any segment. Server prefill only fires
  // while this is false so a half-typed doc number never gets stomped by a slow
  // response arriving after the user's edit.
  const touched = useRef(false);

  // Single sync effect: fires when docNo changes externally (draft resume, hydrate),
  // when the template flips (which resets docNo to blank), and on mount. Compares
  // against the value our current segments would compose so we don't resync right
  // after our own dispatch. All dispatches from here are silent — they're program-
  // matic seeding, not user interaction, so they must not mark the draft dirty.
  useEffect(() => {
    const composedFromSegments = tryCompose(segmentsRef.current, template);
    if (composedFromSegments === docNo) return;

    if (docNo === '') {
      // Blank docNo (new wizard / Start fresh / template flip) — seed the segmented
      // defaults AND write the composed string so filenames + PDF preview reflect it
      // immediately rather than waiting for the user's first keystroke.
      const seed = seedSegments(template, '');
      const composed = tryCompose(seed, template);
      setSegments(seed);
      if (composed) dispatch({ type: 'setMeta', patch: { docNo: composed } }, { silent: true });
      return;
    }

    // Non-blank docNo that doesn't match what our segments compose => external change
    // (resume-draft, hydrate, or an in-progress edit that cleared a required field
    // leaving docNo pinned at its last valid value). Resync segments from the string.
    setSegments(seedSegments(template, docNo));
  }, [docNo, template, dispatch]);

  // Slice 2 (auto-increment after save): when the wizard is opened blank (new doc,
  // template flip, cleared draft), ask the server for the user's next seq. Prefill
  // only when the response arrives AND the user hasn't touched the fields, so we
  // never stomp on typing. The endpoint is best-effort: null on anonymous, un-
  // configured, or fetch failure => leave the factory default 6879 / 5799 in place.
  useEffect(() => {
    if (docNo !== '') return; // only seed a truly blank wizard
    let cancelled = false;
    void fetchNextSeq(template).then((nextSeq) => {
      if (cancelled || !nextSeq || touched.current) return;
      const next = { ...segmentsRef.current, seq: nextSeq } as
        | QuotationSegments
        | ProformaSegments;
      const composed = tryCompose(next, template);
      if (!composed) return;
      setSegments(next);
      dispatch({ type: 'setMeta', patch: { docNo: composed } }, { silent: true });
    });
    return () => {
      cancelled = true;
    };
  }, [docNo, template, dispatch]);

  const update = (next: QuotationSegments | ProformaSegments) => {
    touched.current = true;
    setSegments(next);
    const composed = tryCompose(next, template);
    if (composed !== null) {
      dispatch({ type: 'setMeta', patch: { docNo: composed } });
    }
    // When compose fails (a required segment is blank), hold docNo at its last valid
    // value so PDF preview + filename stay intact; the inline validation error still
    // fires on Continue.
  };

  if (template === 'quotation') {
    const q = segments as QuotationSegments;
    return (
      <div>
        <span className="mb-1 block text-sm font-medium text-black">Document number<span className="ml-0.5 text-red-600" aria-hidden="true">*</span></span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <PrefixCombobox
            label="Prefix"
            value={q.prefix}
            options={QUOTATION_PREFIX_OPTIONS}
            onChange={(v) => update({ ...q, prefix: v })}
          />
          <NumberStepper
            label="Project"
            value={q.project}
            hint="blank = no project segment"
            placeholder="178"
            onChange={(v) => update({ ...q, project: v.replace(/\D/g, '') })}
          />
          <TextField
            label="Year"
            value={q.year}
            hint="defaults to current year"
            placeholder="26"
            onChange={(v) => update({ ...q, year: v.replace(/\D/g, '').slice(0, 4) })}
          />
          <NumberStepper
            label="Document #"
            value={q.seq}
            placeholder="6879"
            onChange={(v) => update({ ...q, seq: v.replace(/\D/g, '') })}
          />
        </div>
        <p className="mt-1 font-mono text-xs text-muted" aria-live="polite">
          Composed: {docNo || '\u00a0'}
        </p>
        {errors['meta.docNo'] && (
          <p role="alert" className="mt-1 text-xs font-medium text-red-700">{errors['meta.docNo']}</p>
        )}
      </div>
    );
  }

  const p = segments as ProformaSegments;
  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-black">Invoice number<span className="ml-0.5 text-red-600" aria-hidden="true">*</span></span>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumberStepper
          label="Invoice #"
          value={p.seq}
          placeholder="5799"
          onChange={(v) => update({ ...p, seq: v.replace(/\D/g, '') })}
        />
        <NumberStepper
          label="Suffix"
          value={p.suffix}
          hint="revision / cents, typically 00"
          placeholder="00"
          onChange={(v) => update({ ...p, suffix: v.replace(/\D/g, '').slice(0, 2) })}
        />
      </div>
      <p className="mt-1 font-mono text-xs text-muted" aria-live="polite">
        Composed: {docNo ? `PROFORMA INVOICE ${docNo}` : '\u00a0'}
      </p>
      {errors['meta.docNo'] && (
        <p role="alert" className="mt-1 text-xs font-medium text-red-700">{errors['meta.docNo']}</p>
      )}
    </div>
  );
}

/**
 * Salutation dropdown + attention-name field.
 *
 * Local state keeps the two halves (`title` and `name`) independent so partial
 * typing is never stomped. The authoritative `meta.attn` string is recomposed on
 * every edit via `composeAttn`. Synced from external attn changes (draft resume,
 * duplicate) when the composed value doesn't match what the local state would
 * produce (same pattern as DocNumberRow).
 *
 * "Custom…" option in the select reveals a free-text input for non-standard
 * titles (e.g. "Prof", "Eng").
 */
function AttnRow({
  attn,
  error,
  dispatch,
}: {
  attn: string;
  error?: string;
  dispatch: (a: WizardAction, opts?: { silent?: boolean }) => void;
}) {
  const init = parseAttnTitle(attn);
  const [title, setTitle] = useState(init.title);
  const [name, setName] = useState(init.name);

  // 'true' when the user selected Custom… or when the existing title is not in
  // the fixed list (e.g. loaded from a draft that has "Prof").
  const isCustom = title !== '' && !(SALUTATION_OPTIONS as readonly string[]).includes(title);

  const stateRef = useRef({ title, name });
  stateRef.current = { title, name };

  // Resync local halves when attn changes externally and doesn't match what we
  // would compose. All dispatches here are silent (programmatic, not a user edit).
  useEffect(() => {
    if (composeAttn(stateRef.current.title, stateRef.current.name) === attn) return;
    const parsed = parseAttnTitle(attn);
    setTitle(parsed.title);
    setName(parsed.name);
  }, [attn]);

  const update = (t: string, n: string) => {
    setTitle(t);
    setName(n);
    dispatch({ type: 'setMeta', patch: { attn: composeAttn(t, n) } });
  };

  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-black">Attention line<span className="ml-0.5 text-red-600" aria-hidden="true">*</span></span>
      <div className="flex items-end gap-2">
        {/* Salutation select */}
        <div className="w-28 shrink-0 sm:w-24">
          <select
            aria-label="Salutation"
            className="w-full min-h-[2.75rem] rounded border border-neutral-300 bg-white px-2 text-sm"
            value={title === '' ? '__none__' : isCustom ? '__custom__' : title}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '__none__') update('', name);
              else if (v === '__custom__') update('Custom', name);
              else update(v, name);
            }}
          >
            <option value="__none__">—</option>
            {SALUTATION_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
            <option value="__custom__">Custom…</option>
          </select>
        </div>
        {/* Custom-title input (only shown when Custom… is selected) */}
        {isCustom && (
          <div className="w-24 shrink-0">
            <input
              type="text"
              aria-label="Custom salutation"
              className="w-full min-h-[2.75rem] rounded border border-neutral-300 px-2 text-sm"
              value={title === 'Custom' ? '' : title}
              placeholder="e.g. Prof"
              onChange={(e) => update(e.target.value, name)}
            />
          </div>
        )}
        {/* Person name */}
        <div className="min-w-0 flex-1">
          <RichInput
            ariaLabel="Attention person name"
            value={name}
            placeholder="Mithun"
            onChange={(v) => update(title, v)}
          />
        </div>
      </div>
      {error && <p role="alert" className="mt-1 text-xs font-medium text-red-700">{error}</p>}
    </div>
  );
}

/**
 * Structured address fields replacing the free-text LinesTextArea.
 *
 * Fixed 4-slot mapping into `client.addressLines[]` (no schema change):
 *  [0] → Address line 1
 *  [1] → Address line 2
 *  [2] → Region
 *  [3] → Postal Code
 *
 * `client.city` stays its own schema field (used by the PDF as a labelled
 * MetaField). The PDF renders addressLines with `.filter(Boolean)` so empty
 * slots drop cleanly without label gaps (EC-8 behaviour).
 */
function AddressBlock({
  addressLines,
  city,
  dispatch,
}: {
  addressLines: string[];
  city: string;
  dispatch: (a: WizardAction, opts?: { silent?: boolean }) => void;
}) {
  const l1 = addressLines[0] ?? '';
  const l2 = addressLines[1] ?? '';
  const region = addressLines[2] ?? '';
  const postal = addressLines[3] ?? '';

  const setAddress = (patch: { l1?: string; l2?: string; region?: string; postal?: string }) => {
    const next = [
      patch.l1 !== undefined ? patch.l1 : l1,
      patch.l2 !== undefined ? patch.l2 : l2,
      patch.region !== undefined ? patch.region : region,
      patch.postal !== undefined ? patch.postal : postal,
    ];
    // Drop trailing blanks; keep interior blanks so slot indices stay stable.
    while (next.length > 0 && !next[next.length - 1]!.trim()) next.pop();
    dispatch({ type: 'setAddressLines', lines: next });
  };

  return (
    <div>
      <h4 className="mb-2 text-sm font-medium">Client address</h4>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Address line 1" value={l1} onChange={(v) => setAddress({ l1: v })} />
        <TextField label="Address line 2" value={l2} onChange={(v) => setAddress({ l2: v })} />
        <TextField
          label="City"
          value={city}
          onChange={(v) => dispatch({ type: 'setClient', patch: { city: v } })}
        />
        <TextField label="Region" value={region} onChange={(v) => setAddress({ region: v })} />
        <TextField label="Postal Code" value={postal} onChange={(v) => setAddress({ postal: v })} />
      </div>
    </div>
  );
}

export function Step1Meta({
  doc,
  errors,
  dispatch,
  savedClients = [],
  onPickClient,
  onRemoveClient,
}: {
  doc: QuoteDocument;
  errors: FieldErrors;
  dispatch: (a: WizardAction, opts?: { silent?: boolean }) => void;
  savedClients?: StoredClient[];
  onPickClient?: (client: Client) => void;
  onRemoveClient?: (id: string) => void;
}) {
  return (
    <div className="space-y-4 [&>section:nth-child(even)]:bg-neutral-100">
      <SectionCard>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Template</legend>
          <div className="flex flex-wrap gap-4">
            {(['quotation', 'proforma'] as const).map((t) => (
              <label key={t} className="flex min-h-[2.5rem] items-center gap-2 text-sm capitalize">
                <input
                  type="radio"
                  name="template"
                  checked={doc.template === t}
                  onChange={() => dispatch({ type: 'setTemplate', template: t })}
                />
                {t === 'proforma' ? 'Proforma Invoice' : 'Quotation'}
              </label>
            ))}
          </div>
        </fieldset>
      </SectionCard>

      <SectionCard>
        <DocNumberRow doc={doc} errors={errors} dispatch={dispatch} />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Quotation date"
            required
            type="date"
            value={doc.meta.quoteDateISO}
            error={errors['meta.quoteDateISO']}
            onChange={(v) => dispatch({ type: 'setMeta', patch: { quoteDateISO: v } })}
          />
          <TextField
            label="Valid until"
            required
            type="date"
            value={doc.meta.validUntilISO}
            error={errors['meta.validUntilISO']}
            onChange={(v) => dispatch({ type: 'setMeta', patch: { validUntilISO: v } })}
          />
        </div>
      </SectionCard>

      <SectionCard title="Client">
        <ClientPicker clients={savedClients} onPick={(c) => onPickClient?.(c)} onRemove={(id) => onRemoveClient?.(id)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <RichInput
            label="Client name"
            required
            value={doc.client.name}
            error={errors['client.name']}
            onChange={(v) => dispatch({ type: 'setClient', patch: { name: v } })}
          />
          <TextField
            label="Cust ID"
            value={doc.client.custId}
            onChange={(v) => dispatch({ type: 'setClient', patch: { custId: v } })}
          />
          <TextField
            label="CR No."
            value={doc.client.crNo}
            onChange={(v) => dispatch({ type: 'setClient', patch: { crNo: v } })}
          />
        </div>

        <AttnRow
          attn={doc.meta.attn}
          error={errors['meta.attn']}
          dispatch={dispatch}
        />

        <AddressBlock
          addressLines={doc.client.addressLines}
          city={doc.client.city}
          dispatch={dispatch}
        />

        <RichInput
          label="Subject"
          value={doc.meta.subject}
          placeholder="Kidds Club Floor"
          onChange={(v) => dispatch({ type: 'setMeta', patch: { subject: v } })}
        />
      </SectionCard>
    </div>
  );
}
