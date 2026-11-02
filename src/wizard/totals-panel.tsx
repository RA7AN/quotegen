/**
 * wizard/totals-panel.tsx — live computed totals (FR-4 / FR-4.8 / AC-5).
 *
 * Rendered as plain read-only text: the user can never type or override a computed
 * total. Numbers come from the same pure `computeTotals` the PDF uses, so the panel
 * and the artefact can never disagree.
 */

import { computeTotals } from '@/domain/calc';
import { formatSar } from '@/lib/money';
import type { QuoteDocument } from '@/domain/types';

export function TotalsPanel({ doc }: { doc: QuoteDocument }) {
  const totals = computeTotals({ lines: doc.lines, commercials: doc.commercials });
  const rows: Array<{ label: string; value: string; emphasise?: boolean }> = [
    { label: 'Total', value: formatSar(totals.totalHalalas) },
  ];
  if (doc.template === 'proforma') {
    rows.push(
      { label: 'Discount', value: formatSar(totals.discountHalalas) },
      { label: 'Total after Discount', value: formatSar(totals.baseHalalas) },
    );
  }
  rows.push(
    { label: `VAT (${(doc.commercials.vatBps / 100).toFixed(2)}%)`, value: formatSar(totals.vatHalalas) },
    { label: 'Grand Total', value: formatSar(totals.grandTotalHalalas), emphasise: true },
    ...totals.splits.map((sp) => ({ label: sp.label, value: formatSar(sp.halalas) })),
  );

  return (
    <section aria-label="Computed totals" className="rounded border border-neutral-200 bg-panel p-3">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Totals (read-only)</h3>
      <dl className="space-y-1 text-sm">
        {rows.map((r) => (
          <div key={r.label} className={`flex justify-between gap-4 ${r.emphasise ? 'font-bold' : ''}`}>
            <dt className="text-black">{r.label}</dt>
            {/* AC-5: computed values are non-editable text, never an input. */}
            <dd className="tabular-nums text-black">
              SAR {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
