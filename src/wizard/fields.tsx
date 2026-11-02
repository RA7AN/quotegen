/**
 * wizard/fields.tsx — shared labelled-input primitives for the wizard + settings chrome.
 *
 * Inline field-level errors only (FR-2.3 / AC-9): no modals, no alerts. Every input is
 * wrapped in a real <label htmlFor> for NFR-4 accessibility.
 */

import { useId } from 'react';
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
