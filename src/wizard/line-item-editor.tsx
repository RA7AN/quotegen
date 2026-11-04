/**
 * wizard/line-item-editor.tsx — one editable line row (FR-3.1..3.5).
 *
 * Description / UOM commit immediately; quantity and unit price keep a local raw string
 * so typing ("1.", "0.5") is never fought by the parser — the integer hundredths/halalas
 * value is committed only when the raw text parses, otherwise an inline error shows and
 * the last valid value stays in the document. S. No is the row index (FR-3.2), so
 * reorder/delete renumber automatically. Computed per-line Price is read-only text
 * (FR-4.8 / AC-5).
 */

import { useState } from 'react';
import { inputClass, RichTextArea } from './fields';
import { parseDecimalToHalalas, formatSar } from '@/lib/money';
import { DEFAULT_UOM_OPTIONS } from '@/domain/defaults';
import { computeLinePriceHalalas } from '@/domain/calc';
import type { LineItem } from '@/domain/types';

/** 250 -> "2.5", 100 -> "1", 55 -> "0.55" (exact inverse of the hundredths parse). */
export function formatHundredths(hundredths: number): string {
  const whole = Math.trunc(hundredths / 100);
  const frac = hundredths % 100;
  if (frac === 0) return `${whole}`;
  if (frac % 10 === 0) return `${whole}.${frac / 10}`;
  return `${whole}.${String(frac).padStart(2, '0')}`;
}

export function LineItemEditor({
  sno,
  line,
  error,
  isFirst,
  isLast,
  onChange,
  onMove,
  onDelete,
}: {
  sno: number;
  line: LineItem;
  error?: string;
  isFirst: boolean;
  isLast: boolean;
  onChange: (patch: Partial<Omit<LineItem, 'id'>>) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [qtyRaw, setQtyRaw] = useState(() => formatHundredths(line.qtyHundredths));
  const [priceRaw, setPriceRaw] = useState(() => formatSar(line.unitPriceHalalas));
  const qtyBad = line.pricing === 'rated' && parseDecimalToHalalas(qtyRaw) === null;
  const priceBad = line.pricing === 'rated' && parseDecimalToHalalas(priceRaw) === null;

  const commitQty = (raw: string) => {
    setQtyRaw(raw);
    const v = parseDecimalToHalalas(raw);
    if (v !== null) onChange({ qtyHundredths: v });
  };
  const commitPrice = (raw: string) => {
    setPriceRaw(raw);
    const v = parseDecimalToHalalas(raw);
    if (v !== null) onChange({ unitPriceHalalas: v });
  };

  return (
    <div className="rounded border border-neutral-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold text-muted">Line {sno}</span>
        <span className="flex items-center gap-1">
          <button
            type="button"
            aria-label={`Move line ${sno} up`}
            disabled={isFirst}
            onClick={() => onMove(-1)}
            className="rounded border border-neutral-300 px-2 py-0.5 text-xs disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            aria-label={`Move line ${sno} down`}
            disabled={isLast}
            onClick={() => onMove(1)}
            className="rounded border border-neutral-300 px-2 py-0.5 text-xs disabled:opacity-30"
          >
            ↓
          </button>
          <button
            type="button"
            aria-label={`Delete line ${sno}`}
            onClick={onDelete}
            className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-700"
          >
            ✕
          </button>
        </span>
      </div>

      <RichTextArea
        ariaLabel={`Description for line ${sno}`}
        rows={2}
        value={line.description}
        placeholder="Supply and install …"
        className={inputClass}
        onChange={(v) => onChange({ description: v })}
      />
      {error && <p role="alert" className="mt-1 text-xs font-medium text-red-700">{error}</p>}

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="block text-xs">
          <span className="mb-1 block font-medium">UOM</span>
          <input
            list="uom-options"
            value={line.uom}
            className={inputClass}
            onChange={(e) => onChange({ uom: e.target.value })}
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-medium">Quantity</span>
          <input
            inputMode="decimal"
            value={qtyRaw}
            aria-invalid={qtyBad || undefined}
            className={inputClass}
            onChange={(e) => commitQty(e.target.value)}
          />
          {qtyBad && <span role="alert" className="mt-1 block text-red-700">Enter a number, e.g. 0.5</span>}
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-medium">Unit price (SAR)</span>
          <input
            inputMode="decimal"
            value={priceRaw}
            disabled={line.pricing === 'included'}
            aria-invalid={priceBad || undefined}
            className={inputClass + ' disabled:bg-neutral-100 disabled:text-muted'}
            onChange={(e) => commitPrice(e.target.value)}
          />
          {priceBad && <span role="alert" className="mt-1 block text-red-700">Enter a number, e.g. 1,234.56</span>}
        </label>
        <label className="flex items-end gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={line.pricing === 'included'}
            onChange={(e) => onChange({ pricing: e.target.checked ? 'included' : 'rated' })}
          />
          <span>Priced as &quot;included&quot;</span>
        </label>
      </div>

      {/* FR-4.8 / AC-5: computed price is display-only text, never an input. */}
      <p className="mt-2 text-right text-sm">
        <span className="text-muted">Price: </span>
        <span className="font-bold tabular-nums">
          {line.pricing === 'included' ? 'included' : `SAR ${formatSar(computeLinePriceHalalas(line))}`}
        </span>
      </p>

      <datalist id="uom-options">
        {DEFAULT_UOM_OPTIONS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
    </div>
  );
}
