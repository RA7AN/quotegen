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
import { TextField, RichInput, LinesTextArea, NumberStepper, PrefixCombobox } from './fields';
import { ClientPicker } from './client-picker';
import type { FieldErrors } from './state';
import type { WizardAction } from './state';
import type { Client, QuoteDocument } from '@/domain/types';
import type { StoredClient } from './library';
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

  const update = (next: QuotationSegments | ProformaSegments) => {
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
        <span className="mb-1 block text-sm font-medium text-black">Document number</span>
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
      <span className="mb-1 block text-sm font-medium text-black">Invoice number</span>
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
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Template (FR-1.3)</legend>
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

      <DocNumberRow doc={doc} errors={errors} dispatch={dispatch} />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Quotation date"
          type="date"
          value={doc.meta.quoteDateISO}
          error={errors['meta.quoteDateISO']}
          onChange={(v) => dispatch({ type: 'setMeta', patch: { quoteDateISO: v } })}
        />
        <TextField
          label="Valid until"
          type="date"
          value={doc.meta.validUntilISO}
          error={errors['meta.validUntilISO']}
          onChange={(v) => dispatch({ type: 'setMeta', patch: { validUntilISO: v } })}
        />
      </div>

      <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Client</h3>
      <ClientPicker clients={savedClients} onPick={(c) => onPickClient?.(c)} onRemove={(id) => onRemoveClient?.(id)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <RichInput
          label="Client name"
          value={doc.client.name}
          error={errors['client.name']}
          onChange={(v) => dispatch({ type: 'setClient', patch: { name: v } })}
        />
        <RichInput
          label="Attention line"
          value={doc.meta.attn}
          placeholder="Mr Mithun"
          onChange={(v) => dispatch({ type: 'setMeta', patch: { attn: v } })}
        />
        <TextField
          label="Cust ID"
          value={doc.client.custId}
          onChange={(v) => dispatch({ type: 'setClient', patch: { custId: v } })}
        />
        <TextField
          label="City"
          value={doc.client.city}
          onChange={(v) => dispatch({ type: 'setClient', patch: { city: v } })}
        />
        <TextField
          label="CR No."
          value={doc.client.crNo}
          onChange={(v) => dispatch({ type: 'setClient', patch: { crNo: v } })}
        />
        <div />
      </div>

      <LinesTextArea
        label="Client address lines"
        lines={doc.client.addressLines}
        hint="One line per row — blanks are dropped on blur"
        onChange={(lines) => dispatch({ type: 'setAddressLines', lines })}
      />

      <RichInput
        label="Subject"
        value={doc.meta.subject}
        placeholder="Kidds Club Floor"
        onChange={(v) => dispatch({ type: 'setMeta', patch: { subject: v } })}
      />
    </div>
  );
}
