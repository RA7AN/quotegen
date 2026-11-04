/**
 * wizard/step1-meta.tsx — Step 1: Meta & client (FR-2.1 step 1).
 *
 * Template choice (FR-1.3), document number/dates, client block, attn + subject.
 * Errors are the inline field-level messages from state.ts validation (AC-9).
 */

import { TextField, RichInput, LinesTextArea } from './fields';
import type { FieldErrors } from './state';
import type { QuoteDocument } from '@/domain/types';
import type { WizardAction } from './state';

export function Step1Meta({
  doc,
  errors,
  dispatch,
}: {
  doc: QuoteDocument;
  errors: FieldErrors;
  dispatch: (a: WizardAction) => void;
}) {
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Template (FR-1.3)</legend>
        <div className="flex gap-4">
          {(['quotation', 'proforma'] as const).map((t) => (
            <label key={t} className="flex items-center gap-1.5 text-sm capitalize">
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

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Document number"
          value={doc.meta.docNo}
          error={errors['meta.docNo']}
          placeholder="ENCM-26-6879"
          onChange={(v) => dispatch({ type: 'setMeta', patch: { docNo: v } })}
        />
        <TextField
          label="Project segment (optional)"
          value={doc.meta.projectSegment ?? ''}
          hint="e.g. 178 → ENCM-178-26-6824.pdf"
          onChange={(v) => dispatch({ type: 'setMeta', patch: { projectSegment: v } })}
        />
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
