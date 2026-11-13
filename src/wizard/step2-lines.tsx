/**
 * wizard/step2-lines.tsx — Step 2: line items & commercials (FR-2.1 step 2, FR-3, FR-4).
 *
 * Lines get add/reorder/delete (FR-3.1/3.2), commercials are template-aware: VAT bps is
 * always editable (EC-10), discount + advance splits belong to the proforma, free-text
 * payment terms to the quotation. The TotalsPanel beside the inputs recomputes live via
 * the same pure engine the PDF uses.
 */

import { LineItemEditor } from './line-item-editor';
import { TotalsPanel } from './totals-panel';
import { TextField, StringListEditor, SectionCard, inputClass } from './fields';
import { parseDecimalToHalalas, formatSar } from '@/lib/money';
import { parsePercentHundredths } from '@/lib/percent';
import type { FieldErrors, WizardAction } from './state';
import type { QuoteDocument } from '@/domain/types';

export function Step2Lines({
  doc,
  errors,
  dispatch,
  onAddLine,
}: {
  doc: QuoteDocument;
  errors: FieldErrors;
  dispatch: (a: WizardAction) => void;
  onAddLine: () => void;
}) {
  const isProforma = doc.template === 'proforma';
  const { commercials } = doc;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
      <div className="space-y-4 [&>section:nth-child(even)]:bg-neutral-100">
        <SectionCard
          title="Line items"
          required
          action={
            <button
              type="button"
              onClick={onAddLine}
              className="rounded bg-black px-3 py-1 text-sm font-medium text-white hover:bg-neutral-800"
            >
              + Add line
            </button>
          }
        >
          {errors['lines'] && <p role="alert" className="text-xs font-medium text-red-700">{errors['lines']}</p>}
          {doc.lines.map((line, i) => (
            <LineItemEditor
              key={line.id}
              sno={i + 1}
              line={line}
              error={errors[`line.${line.id}.description`]}
              isFirst={i === 0}
              isLast={i === doc.lines.length - 1}
              onChange={(patch) => dispatch({ type: 'updateLine', id: line.id, patch })}
              onMove={(dir) => dispatch({ type: 'moveLine', id: line.id, dir })}
              onDelete={() => dispatch({ type: 'deleteLine', id: line.id })}
            />
          ))}
        </SectionCard>

        <SectionCard title="Commercials">
          <div className="grid gap-4 sm:grid-cols-2">
            <VatField doc={doc} dispatch={dispatch} />
            {isProforma && <DiscountField doc={doc} dispatch={dispatch} />}
          </div>

          {!isProforma && (
            <StringListEditor
              label="Payment terms"
              lines={commercials.paymentTermsText}
              addLabel="Add payment term"
              placeholder="e.g. 100% advance"
              hint="Each line prints as a bullet under Payment Terms."
              onChange={(lines) => dispatch({ type: 'setPaymentTerms', lines })}
            />
          )}

          {isProforma && (
            <SplitsEditor doc={doc} errors={errors} dispatch={dispatch} />
          )}
        </SectionCard>
      </div>

      <TotalsPanel doc={doc} />
    </div>
  );
}

/** VAT percent as user-typed text; committed as integer basis points when it parses. */
function VatField({ doc, dispatch }: { doc: QuoteDocument; dispatch: (a: WizardAction) => void }) {
  const bps = doc.commercials.vatBps;
  return (
    <TextField
      label="VAT rate (%)"
      value={bps % 100 === 0 ? `${bps / 100}` : (bps / 100).toFixed(2)}
      hint="Default 15"
      onChange={(v) => {
        const hundredths = parsePercentHundredths(v);
        if (hundredths !== null && hundredths <= 10_000) dispatch({ type: 'setCommercials', patch: { vatBps: hundredths } });
      }}
    />
  );
}

function DiscountField({ doc, dispatch }: { doc: QuoteDocument; dispatch: (a: WizardAction) => void }) {
  const { discountMode, discountValue } = doc.commercials;
  const raw =
    discountMode === 'amount' && discountValue > 0
      ? formatSar(discountValue)
      : discountMode === 'percent' && discountValue > 0
        ? (discountValue / 100).toFixed(2)
        : '';
  return (
    <div className="space-y-2">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Discount (proforma)</span>
        <select
          value={discountMode}
          className={inputClass}
          onChange={(e) => {
            const mode = e.target.value as 'none' | 'amount' | 'percent';
            dispatch({ type: 'setCommercials', patch: { discountMode: mode, discountValue: mode === 'none' ? 0 : discountValue } });
          }}
        >
          <option value="none">None</option>
          <option value="amount">Fixed amount (SAR)</option>
          <option value="percent">Percent (%)</option>
        </select>
      </label>
      {discountMode !== 'none' && (
        <TextField
          label={discountMode === 'amount' ? 'Discount amount (SAR)' : 'Discount percent (%)'}
          value={raw}
          onChange={(v) => {
            const parsed = discountMode === 'amount' ? parseDecimalToHalalas(v) : parsePercentHundredths(v);
            if (parsed !== null) dispatch({ type: 'setCommercials', patch: { discountValue: parsed } });
          }}
        />
      )}
    </div>
  );
}

function SplitsEditor({ doc, errors, dispatch }: { doc: QuoteDocument; errors: FieldErrors; dispatch: (a: WizardAction) => void }) {
  const splits = doc.commercials.advanceSplits;
  const setSplits = (next: typeof splits) => dispatch({ type: 'setSplits', splits: next });
  return (
    <div>
      <h4 className="mb-1 text-sm font-medium">Payment splits (must total 100%)</h4>
      {splits.map((sp, i) => (
        <div key={i} className="mb-2 grid grid-cols-[1fr_90px_auto] items-center gap-2">
          <input
            aria-label={`Split ${i + 1} label`}
            value={sp.label}
            className={inputClass}
            onChange={(e) => setSplits(splits.map((s, j) => (j === i ? { ...s, label: e.target.value } : s)))}
          />
          <input
            aria-label={`Split ${i + 1} percent`}
            inputMode="decimal"
            defaultValue={(sp.percentHundredths / 100).toString()}
            className={inputClass}
            onBlur={(e) => {
              const pct = parsePercentHundredths(e.target.value);
              if (pct !== null) {
                setSplits(splits.map((s, j) => (j === i ? { ...s, percentHundredths: pct } : s)));
              } else {
                e.target.value = (sp.percentHundredths / 100).toString();
              }
            }}
          />
          <button
            type="button"
            aria-label={`Remove split ${i + 1}`}
            className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
            onClick={() => setSplits(splits.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      ))}
      {errors['commercials.advanceSplits'] && (
        <p role="alert" className="mb-2 text-xs font-medium text-red-700">{errors['commercials.advanceSplits']}</p>
      )}
      <button
        type="button"
        className="rounded border border-neutral-300 px-3 py-1 text-xs font-medium"
        onClick={() => setSplits([...splits, { label: `${splits.length === 0 ? 100 : 0}% Advance`, percentHundredths: 0 }])}
      >
        + Add split
      </button>
    </div>
  );
}
