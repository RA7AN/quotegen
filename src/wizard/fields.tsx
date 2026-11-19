/**
 * wizard/fields.tsx — shared labelled-input primitives for the wizard + settings chrome.
 *
 * Inline field-level errors only (FR-2.3 / AC-9): no modals, no alerts. Every input is
 * wrapped in a real <label htmlFor> for NFR-4 accessibility.
 */

import { Children, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/* ------------------------------------------------------------------ *
 * SectionCard — faintly-tinted card wrapper for logical form groups.  *
 * ------------------------------------------------------------------ */

/**
 * Wraps a logical section of the wizard in a light card (rounded-lg, border).
 *
 * `title`    — optional section heading (uppercase muted h3).
 * `required` — red asterisk after the title.
 * `action`   — rendered right-aligned in the same header row as the title
 *              (e.g. "+ Add line" or "↺ Restore defaults").
 * `dashed`   — uses a dashed border (e.g. the suggestions panel) instead of solid.
 *
 * Children get `space-y-4` internally. When `title` is absent, no header row is
 * rendered (useful for sections that already have their own fieldset/legend).
 *
 * Tint alternation is handled by the parent container using
 * `[&>section:nth-child(even)]:bg-neutral-100`, not by props here.
 */
export function SectionCard({
  title,
  required,
  action,
  dashed = false,
  children,
}: {
  title?: string;
  required?: boolean;
  action?: ReactNode;
  dashed?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`rounded-lg border bg-neutral-50 p-4 ${
      dashed ? 'border-dashed border-neutral-300' : 'border-neutral-200'
    }`}>
      {title && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted">
            {title}
            {required && <span className="ml-0.5 font-sans normal-case tracking-normal text-red-600" aria-hidden="true">*</span>}
          </h3>
          {action}
        </div>
      )}
      <div className="space-y-4">
        {children}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * FloatingToast — fixed-position notification stack.                  *
 * ------------------------------------------------------------------ */

/**
 * A single dismissible floating notification item.
 * Wrap one or more in `<FloatingToastStack>` for the viewport container.
 */
export function FloatingToast({
  message,
  variant = 'success',
  onDismiss,
}: {
  message: string;
  variant?: 'success' | 'info' | 'error';
  onDismiss: () => void;
}) {
  if (!message) return null;
  const cls = variant === 'success'
    ? 'border-green-300 bg-green-50 text-green-800'
    : variant === 'error'
      ? 'border-red-300 bg-red-50 text-red-700'
      : 'border-gold bg-yellow-50 text-black';
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto flex items-start gap-1 rounded-lg border px-4 py-2.5 text-sm shadow-lg ${cls}`}
    >
      <span className="flex-1">{message}</span>
      {/* 44 px hit area via min-size + negative margins, so the card stays compact (#49:
          the old × measured 13×18). */}
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={onDismiss}
        className="-my-1 -mr-2 flex min-h-[2.75rem] min-w-[2.75rem] shrink-0 items-center justify-center rounded p-1 text-lg leading-none opacity-50 hover:opacity-100 focus:opacity-100"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}

/**
 * Viewport container for one or more FloatingToast children (#49).
 *
 * It used to be `bottom-4 right-4 max-w-xs` — a 319 px card landing exactly on the
 * bottom-right corner where the wizard's Continue/Download controls live (and where the
 * fixed tab bar now sits). On phones it goes full-width above the tab bar, with the
 * safe-area inset added; from `sm:` up it returns to the corner. Stacks are capped at
 * `max` visible cards with the remainder behind a "+N more" toggle so three toasts can
 * never cover the screen.
 */
export function FloatingToastStack({ children, max = 2 }: { children: ReactNode; max?: number }) {
  const [expanded, setExpanded] = useState(false);
  const items = Children.toArray(children);
  const shown = expanded ? items : items.slice(0, max);
  const hidden = items.length - shown.length;
  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-50 flex flex-col gap-2 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-80">
      {shown}
      {items.length > max && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="pointer-events-auto self-end rounded px-2 py-1 text-xs font-medium text-muted underline-offset-2 hover:underline"
        >
          {expanded ? 'Show fewer' : `+${hidden} more`}
        </button>
      )}
    </div>
  );
}

export function FieldShell({ label, required, error, hint, children }: { label: string; required?: boolean; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-black">{label}{required && <span className="ml-0.5 text-red-600" aria-hidden="true">*</span>}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span role="alert" className="mt-1 block text-xs font-medium text-red-700">{error}</span>}
    </label>
  );
}

/**
 * #50 (P1): the single field token the whole product inherits. It was `text-sm py-1.5`
 * (14 px, ~34 px tall), which makes iOS Safari auto-zoom the viewport to ~230 % on focus
 * and leaves a sub-44 px target on every other browser — NFR-6 / the repo's own "≥16 px,
 * ≥44 px" rule. Now `text-base` + `min-h-[2.75rem]` so focusing changes no scale.
 * Labels/hints/errors below stay `text-xs`/`text-sm`: they are never focused.
 */
export const inputClass =
  'w-full min-h-[2.75rem] rounded border border-neutral-300 bg-white px-3 py-2 text-base ' +
  'focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold';

/* ------------------------------------------------------------------ *
 * PasswordField — labelled password input with an inline reveal toggle. *
 *                                                                    *
 * A real <button type="button"> sits at the trailing edge and flips the *
 * input between type=password and type=text. It never touches value, *
 * validation, or submission (issue #39, AC-9: no native dialogs). The *
 * button lives inside FieldShell's <label>, so preventDefault() stops *
 * label activation from stealing focus back to the input on toggle.   *
 * ------------------------------------------------------------------ */

function EyeIcon({ off }: { off?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
      {off && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  );
}

export function PasswordField({
  label,
  required,
  error,
  hint,
  name,
  autoComplete = 'current-password',
  value,
  onChange,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  name: string;
  autoComplete?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <FieldShell label={label} required={required} error={error} hint={hint}>
      <span className="relative block">
        <input
          className={inputClass + ' pr-9'}
          type={revealed ? 'text' : 'password'}
          name={name}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setRevealed((r) => !r);
          }}
          aria-label={revealed ? 'Hide password' : 'Show password'}
          aria-pressed={revealed}
          title={revealed ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 flex min-w-[2.75rem] items-center justify-center px-2.5 text-neutral-500 hover:text-black focus:outline-none focus-visible:ring-1 focus-visible:ring-gold"
        >
          <EyeIcon off={revealed} />
        </button>
      </span>
    </FieldShell>
  );
}

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
  // #50: the inline B/I/U toggles measured 26×18 in a 4 px gap row — below the 44 px / 8 px
  // thumb rule (AC-2). Now square 44 px tap targets with a 12 px gap; the label is aria-only.
  const btn =
    'inline-flex min-h-[2.75rem] min-w-[2.75rem] items-center justify-center rounded border border-neutral-300 bg-white text-sm leading-none hover:bg-neutral-100';
  return (
    <div className="mb-1 flex gap-3">
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
  required,
  value,
  onChange,
  error,
  hint,
  placeholder,
  type = 'text',
  inputMode,
  autoComplete,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  type?: 'text' | 'date' | 'email';
  inputMode?: 'numeric' | 'decimal' | 'tel' | 'email';
  autoComplete?: string;
}) {
  const id = useId();
  return (
    <FieldShell label={label} required={required} error={error} hint={hint}>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
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
  ariaLabel,
  required,
  value,
  onChange,
  error,
  hint,
  placeholder,
}: {
  label?: string;
  ariaLabel?: string;
  required?: boolean;
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
      {label && <label htmlFor={id} className="mb-1 block font-medium text-black">{label}{required && <span className="ml-0.5 text-red-600" aria-hidden="true">*</span>}</label>}
      <FormatToolbar onFormat={fmt} />
      <input
        ref={ref}
        id={id}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
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
  required,
  value,
  onChange,
  placeholder,
  rows = 3,
  className,
}: {
  label?: string;
  ariaLabel?: string;
  required?: boolean;
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
      {label && <span className="mb-1 block text-sm font-medium text-black">{label}{required && <span className="ml-0.5 text-red-600" aria-hidden="true">*</span>}</span>}
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
        <div key={i} className="flex items-start gap-3">
          <span aria-hidden className="mt-3 select-none text-muted">•</span>
          <div className="flex-1">
            <RichInput value={l} placeholder={placeholder} onChange={(v) => set(i, v)} />
          </div>
          {/* #50: remove was a 27×26 px `text-xs` chip — now a 44 px row control. */}
          <button
            type="button"
            aria-label={`Remove ${label} ${i + 1}`}
            className="mt-6 inline-flex min-h-[2.75rem] min-w-[2.75rem] items-center justify-center rounded border border-red-300 px-2 text-sm text-red-700"
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
        className="inline-flex min-h-[2.75rem] items-center rounded border border-neutral-300 px-4 text-sm font-medium hover:bg-neutral-100"
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
  required,
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
  required?: boolean;
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
      <label htmlFor={id} className="mb-1 block font-medium text-black">{label}{required && <span className="ml-0.5 text-red-600" aria-hidden="true">*</span>}</label>
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
  required,
  value,
  options,
  onChange,
  error,
  customPlaceholder = 'e.g. ABC-',
}: {
  label: string;
  required?: boolean;
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
      <label htmlFor={id} className="mb-1 block font-medium text-black">{label}{required && <span className="ml-0.5 text-red-600" aria-hidden="true">*</span>}</label>
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
