/**
 * wizard/fields.tsx — shared labelled-input primitives for the wizard + settings chrome.
 *
 * Inline field-level errors only (FR-2.3 / AC-9): no modals, no alerts. Every input is
 * wrapped in a real <label htmlFor> for NFR-4 accessibility.
 */

import { useId, useRef } from 'react';
import type { ReactNode } from 'react';

export function FieldShell({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-black">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span role="alert" className="mt-1 block text-xs font-medium text-red-700">{error}</span>}
    </label>
  );
}

export const inputClass =
  'w-full rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-sm ' +
  'focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold';

/* ------------------------------------------------------------------ *
 * Inline-markup editing (bold / italic / underline).                 *
 *                                                                    *
 * These widgets insert the reserved **bold** / *italic* / __underline__
 * tokens (see lib/inline.ts) around the current selection so the same
 * string feeds the plain-text codec and the PDF <Inline> renderer. No
 * rich-text dependency, no HTML — the value stays a plain string.     *
 * ------------------------------------------------------------------ */

type RichEl = HTMLInputElement | HTMLTextAreaElement;

/** Wrap (or, if already wrapped, unwrap) the selection in `before`/`after` tokens. */
function applyWrap(el: RichEl, before: string, after: string, onChange: (v: string) => void): void {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const value = el.value;
  const pre = value.slice(Math.max(0, start - before.length), start);
  const post = value.slice(end, end + after.length);
  const inner = value.slice(start, end);
  let next: string;
  let selStart: number;
  if (pre === before && post === after) {
    next = value.slice(0, start - before.length) + inner + value.slice(end + after.length);
    selStart = start - before.length;
  } else {
    next = value.slice(0, start) + before + inner + after + value.slice(end);
    selStart = start + before.length;
  }
  onChange(next);
  // Restore the (now token-shifted) selection once the controlled value has re-rendered.
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(selStart, selStart + inner.length);
  });
}

function FormatToolbar({ onFormat }: { onFormat: (before: string, after?: string) => void }) {
  const btn = 'rounded border border-neutral-300 bg-white px-2 py-0.5 text-xs leading-none hover:bg-neutral-100';
  return (
    <div className="mb-1 flex gap-1">
      <button type="button" aria-label="Bold" className={btn} style={{ fontWeight: 700 }} onClick={() => onFormat('**')}>
        B
      </button>
      <button type="button" aria-label="Italic" className={btn} style={{ fontStyle: 'italic' }} onClick={() => onFormat('*')}>
        I
      </button>
      <button type="button" aria-label="Underline" className={btn} style={{ textDecoration: 'underline' }} onClick={() => onFormat('__')}>
        U
      </button>
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  error,
  hint,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  type?: 'text' | 'date' | 'email';
}) {
  const id = useId();
  return (
    <FieldShell label={label} error={error} hint={hint}>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        className={inputClass}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldShell>
  );
}

/**
 * Labelled single-line input with a bold/italic/underline toolbar. Drop-in for {@link TextField}
 * on free-text content fields. `label` is optional so it can also be used inside list editors.
 */
export function RichInput({
  label,
  value,
  onChange,
  error,
  hint,
  placeholder,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
}) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const fmt = (before: string, after = before) => {
    if (ref.current) applyWrap(ref.current, before, after, onChange);
  };
  return (
    <div className="block text-sm">
      {label && <label htmlFor={id} className="mb-1 block font-medium text-black">{label}</label>}
      <FormatToolbar onFormat={fmt} />
      <input
        ref={ref}
        id={id}
        value={value}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        className={inputClass}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span role="alert" className="mt-1 block text-xs font-medium text-red-700">{error}</span>}
    </div>
  );
}

/** Multi-line sibling of {@link RichInput} — used for clauses and line-item descriptions. */
export function RichTextArea({
  label,
  ariaLabel,
  value,
  onChange,
  placeholder,
  rows = 3,
  className,
}: {
  label?: string;
  ariaLabel?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fmt = (before: string, after = before) => {
    if (ref.current) applyWrap(ref.current, before, after, onChange);
  };
  return (
    <div>
      {label && <span className="mb-1 block text-sm font-medium text-black">{label}</span>}
      <FormatToolbar onFormat={fmt} />
      <textarea
        ref={ref}
        aria-label={ariaLabel}
        rows={rows}
        value={value}
        placeholder={placeholder}
        className={className ?? inputClass}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/** Multi-line value <-> string[] codec: one entry per line, blanks dropped. */
export function LinesTextArea({
  label,
  lines,
  onChange,
  error,
  hint,
  rows = 3,
}: {
  label: string;
  lines: string[];
  onChange: (lines: string[]) => void;
  error?: string;
  hint?: string;
  rows?: number;
}) {
  const id = useId();
  return (
    <FieldShell label={label} error={error} hint={hint}>
      <textarea
        id={id}
        rows={rows}
        value={lines.join('\n')}
        aria-invalid={error ? true : undefined}
        className={inputClass}
        onChange={(e) => onChange(e.target.value.split('\n').map((l) => l.trimEnd()))}
        onBlur={(e) => onChange(e.target.value.split('\n').filter((l) => l.trim() !== ''))}
      />
    </FieldShell>
  );
}

/**
 * Editable string list rendered as one single-line input per entry, each prefixed with a
 * bullet (mirroring the PDF) and removable, plus an add button. Used for payment terms.
 */
export function StringListEditor({
  label,
  lines,
  onChange,
  error,
  hint,
  addLabel = 'Add line',
  placeholder,
}: {
  label: string;
  lines: string[];
  onChange: (lines: string[]) => void;
  error?: string;
  hint?: string;
  addLabel?: string;
  placeholder?: string;
}) {
  const set = (i: number, v: string) => onChange(lines.map((l, j) => (j === i ? v : l)));
  const remove = (i: number) => onChange(lines.filter((_, j) => j !== i));
  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-black">{label}</span>
      {lines.map((l, i) => (
        <div key={i} className="flex items-start gap-2">
          <span aria-hidden className="mt-2 select-none text-muted">•</span>
          <div className="flex-1">
            <RichInput value={l} placeholder={placeholder} onChange={(v) => set(i, v)} />
          </div>
          <button
            type="button"
            aria-label={`Remove ${label} ${i + 1}`}
            className="mt-6 rounded border border-red-300 px-2 py-1 text-xs text-red-700"
            onClick={() => remove(i)}
          >
            ✕
          </button>
        </div>
      ))}
      {error && <p role="alert" className="text-xs font-medium text-red-700">{error}</p>}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      <button
        type="button"
        className="rounded border border-neutral-300 px-3 py-1 text-xs font-medium hover:bg-neutral-100"
        onClick={() => onChange([...lines, ''])}
      >
        + {addLabel}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Numeric stepper + prefix combobox for the segmented doc-number row *
 * (wizard doc-number split). Both are controlled inputs; the parent *
 * owns the string value so parsing/composing stays in lib/doc-number.*
 * ------------------------------------------------------------------ */

/**
 * Bump `current` by `delta`, clamped to [min, max]. Preserves zero padding when the
 * user typed it (e.g. "0001" +/- 1 -> "0002" / "0000"), otherwise emits plain digits.
 */
function bumpNumeric(current: string, delta: number, min: number, max: number): string {
  const parsed = parseInt(current, 10);
  const base = Number.isFinite(parsed) ? parsed : min;
  const next = Math.max(min, Math.min(max, base + delta));
  const padded = current.length > 1 && current[0] === '0';
  return padded ? String(next).padStart(current.length, '0') : String(next);
}

/**
 * Labelled numeric input with -/+ steppers. Kept as text (not `type="number"`) with
 * `inputMode="numeric"` so mobile keyboards show digits AND we avoid the browser
 * spinner affordance clashing with our explicit steppers. Value is a plain string
 * so leading zeros survive composition with the parent's parse/compose codec.
 */
export function NumberStepper({
  label,
  value,
  onChange,
  min = 0,
  max = 99_999_999,
  error,
  hint,
  placeholder,
  ariaGroupLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  error?: string;
  hint?: string;
  placeholder?: string;
  ariaGroupLabel?: string;
}) {
  const id = useId();
  return (
    <div className="block text-sm">
      <label htmlFor={id} className="mb-1 block font-medium text-black">{label}</label>
      <div
        role="group"
        aria-label={ariaGroupLabel ? `${ariaGroupLabel} stepper` : label}
        className="flex items-stretch gap-1"
      >
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          className="min-h-[2.75rem] min-w-[2.75rem] shrink-0 rounded border border-neutral-300 bg-white text-base font-medium hover:bg-neutral-100 active:bg-neutral-200"
          onClick={() => onChange(bumpNumeric(value, -1, min, max))}
        >
          −
        </button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={value}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          className={inputClass + ' min-w-0 flex-1 text-center'}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          aria-label={`Increase ${label}`}
          className="min-h-[2.75rem] min-w-[2.75rem] shrink-0 rounded border border-neutral-300 bg-white text-base font-medium hover:bg-neutral-100 active:bg-neutral-200"
          onClick={() => onChange(bumpNumeric(value, +1, min, max))}
        >
          +
        </button>
      </div>
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span role="alert" className="mt-1 block text-xs font-medium text-red-700">{error}</span>}
    </div>
  );
}

/**
 * Prefix picker: fixed options (e.g. `ENCM-`) plus `Custom…` which reveals a text
 * input for the user's own string. When the current value isn't in the fixed list
 * (legacy doc, restored draft), the picker auto-switches to Custom mode so nothing
 * is silently lost.
 */
export function PrefixCombobox({
  label,
  value,
  options,
  onChange,
  error,
  customPlaceholder = 'e.g. ABC-',
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  error?: string;
  customPlaceholder?: string;
}) {
  const id = useId();
  const CUSTOM = '__custom__';
  const isFixed = options.includes(value);
  const selectValue = isFixed ? value : CUSTOM;
  return (
    <div className="block text-sm">
      <label htmlFor={id} className="mb-1 block font-medium text-black">{label}</label>
      <select
        id={id}
        className={inputClass + ' min-h-[2.75rem]'}
        value={selectValue}
        aria-invalid={error ? true : undefined}
        onChange={(e) => {
          // Selecting "Custom…" clears the value so the text input is focused on typing.
          onChange(e.target.value === CUSTOM ? '' : e.target.value);
        }}
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
        <option value={CUSTOM}>Custom…</option>
      </select>
      {!isFixed && (
        <input
          type="text"
          aria-label={`${label} (custom)`}
          value={value}
          placeholder={customPlaceholder}
          className={inputClass + ' mt-1'}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {error && <span role="alert" className="mt-1 block text-xs font-medium text-red-700">{error}</span>}
    </div>
  );
}
