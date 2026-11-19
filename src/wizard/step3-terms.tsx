/**
 * wizard/step3-terms.tsx — Step 3: terms & conditions.
 *
 * Two fixed defaults seed every quote (validity first, scope variation last); they are
 * removable but the app warns first via ConfirmDialog. The old "Execution Time" clause is
 * now a muted suggestion the user can accept (inserted before the last default) or dismiss.
 * "Restore default clauses" re-adds any missing fixed defaults without touching the user's
 * own clauses. The sign-off block lives here too, with a saved-blocks picker (#11 slice 4)
 * that autofills the closing and removes stored blocks behind a ConfirmDialog. This step
 * never blocks navigation.
 */

import { useState } from 'react';
import Link from 'next/link';
import { TextField, RichInput, RichTextArea, SectionCard, inputClass } from './fields';
import { ConfirmDialog } from './confirm-dialog';
import { SignoffPicker } from './signoff-picker';
import type { ReactNode } from 'react';
import type { WizardAction } from './state';
import type { Closing, QuoteDocument } from '@/domain/types';
import type { StoredSignoff } from './library';
import {
  DEFAULT_FIRST_CLAUSE,
  DEFAULT_LAST_CLAUSE,
  SUGGESTED_TERMS_CLAUSES,
} from '@/domain/defaults';

const isDefaultClause = (t: string) => t === DEFAULT_FIRST_CLAUSE || t === DEFAULT_LAST_CLAUSE;

export function Step3Terms({
  doc,
  dispatch,
  savedSignoffs = [],
  onPickSignoff,
  onRemoveSignoff,
  bankGaps = [],
}: {
  doc: QuoteDocument;
  dispatch: (a: WizardAction) => void;
  savedSignoffs?: StoredSignoff[];
  onPickSignoff?: (block: Closing) => void;
  onRemoveSignoff?: (id: string) => void;
  /** #6: labels of blank proforma bank fields (empty = nothing to advise). */
  bankGaps?: string[];
}) {
  const clauses = doc.terms.clauses;
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [pendingRemove, setPendingRemove] = useState<number | null>(null);

  const setClauses = (next: string[]) => dispatch({ type: 'setTermsClauses', clauses: next });
  const update = (i: number, v: string) => setClauses(clauses.map((c, j) => (j === i ? v : c)));
  const remove = (i: number) => setClauses(clauses.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) => {
    const to = i + dir;
    if (to < 0 || to >= clauses.length) return;
    const next = [...clauses];
    const a = next[i];
    const b = next[to];
    if (a === undefined || b === undefined) return;
    next[i] = b;
    next[to] = a;
    setClauses(next);
  };
  const insertAt = (i: number) => {
    const next = [...clauses];
    next.splice(i, 0, '');
    setClauses(next);
  };

  // Deleting a fixed default routes through the warning dialog; anything else is immediate.
  const requestRemove = (i: number) => {
    const text = clauses[i];
    if (text !== undefined && isDefaultClause(text)) setPendingRemove(i);
    else remove(i);
  };

  const suggestions = SUGGESTED_TERMS_CLAUSES.filter((s) => !clauses.includes(s) && !dismissed.includes(s));
  const acceptSuggestion = (s: string) => {
    const lastIdx = clauses.indexOf(DEFAULT_LAST_CLAUSE);
    const at = lastIdx >= 0 ? lastIdx : clauses.length;
    const next = [...clauses];
    next.splice(at, 0, s);
    setClauses(next);
  };

  const restoreDefaults = () => {
    const next = [...clauses];
    if (!next.includes(DEFAULT_FIRST_CLAUSE)) next.unshift(DEFAULT_FIRST_CLAUSE);
    if (!next.includes(DEFAULT_LAST_CLAUSE)) next.push(DEFAULT_LAST_CLAUSE);
    setClauses(next);
    setDismissed([]); // re-surface the suggestions too
  };

  // The advisory sits OUTSIDE the tinted-card wrapper so the nth-child(even)
  // alternation of the SectionCards below keeps its parity (issue #6).
  return (
    <>
      {bankGaps.length > 0 && (
        <div role="status" className="mb-4 rounded border border-gold bg-yellow-50 px-3 py-2 text-sm dark:bg-yellow-950/40">
          This proforma's ACCOUNT DETAILS will be missing the{' '}
          <strong>{bankGaps.join(' and ')}</strong> — add{' '}
          {bankGaps.length === 1 ? 'it' : 'them'} in{' '}
          <Link href="/settings" className="font-medium underline hover:text-gold-light">Settings → Bank (proforma)</Link>{' '}
          before exporting.
        </div>
      )}
    <div className="space-y-4 [&>section:nth-child(even)]:bg-neutral-100">
      <SectionCard
        title="Terms & Conditions"
        action={
          <button
            type="button"
            onClick={restoreDefaults}
            className="inline-flex min-h-[2.75rem] items-center rounded border border-neutral-300 px-4 text-sm font-medium hover:bg-neutral-100"
          >
            ↺ Restore default clauses
          </button>
        }
      >
        <p className="text-xs text-muted">
          The first (validity) and last (scope variation) clauses are the defaults — removing one asks for
          confirmation. Use<span className="mx-1 font-medium">＋</span>to insert a clause in the middle and the
          arrows to reorder.
        </p>

        {clauses.map((c, i) => (
          <div key={i} className={`space-y-1 rounded border p-2 ${isDefaultClause(c) ? 'border-gold bg-yellow-50/40' : 'border-neutral-200'}`}>
            <div className="flex items-start gap-2">
              <span className="mt-2 w-5 shrink-0 text-right text-xs font-semibold text-muted">{i + 1}.</span>
              <div className="flex-1">
                <RichTextArea ariaLabel={`Clause ${i + 1}`} rows={2} value={c} className={inputClass} onChange={(v) => update(i, v)} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 pl-7">
              {/* #50: insert (＋) used to sit directly beside remove (✕) at 26–30 px — one mis-tap
                  away on a phone. Reorder + insert stay grouped; delete is separated by a divider. */}
              <span className="flex items-center gap-3">
                <RowBtn label={`Move clause ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</RowBtn>
                <RowBtn label={`Move clause ${i + 1} down`} disabled={i === clauses.length - 1} onClick={() => move(i, 1)}>↓</RowBtn>
                <RowBtn label={`Insert clause after ${i + 1}`} onClick={() => insertAt(i + 1)}>＋</RowBtn>
              </span>
              <span className="ml-2 flex items-center gap-3 border-l border-neutral-200 pl-3">
                <RowBtn label={`Remove clause ${i + 1}`} danger onClick={() => requestRemove(i)}>✕</RowBtn>
              </span>
              {isDefaultClause(c) && <span className="text-[11px] italic text-muted">default</span>}
            </div>
          </div>
        ))}

        <button
          type="button"
          className="inline-flex min-h-[2.75rem] items-center rounded border border-neutral-300 px-4 text-sm font-medium hover:bg-neutral-100"
          onClick={() => insertAt(Math.max(0, clauses.length - 1))}
        >
          + Add clause
        </button>
      </SectionCard>

      {suggestions.length > 0 && (
        <SectionCard title="Suggested clauses" dashed>
          {suggestions.map((s) => (
            <div key={s} className="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-600">
              <span className="italic">{s}</span>
              <span className="flex gap-3">
                <button
                  type="button"
                  onClick={() => acceptSuggestion(s)}
                  className="inline-flex min-h-[2.75rem] items-center rounded bg-black px-3 text-sm font-medium text-white hover:bg-neutral-800"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => setDismissed((d) => [...d, s])}
                  className="inline-flex min-h-[2.75rem] items-center rounded border border-neutral-400 px-3 text-sm hover:bg-neutral-100"
                >
                  Dismiss
                </button>
              </span>
            </div>
          ))}
        </SectionCard>
      )}

      <SectionCard title="Sign-off block">
        <SignoffPicker blocks={savedSignoffs} onPick={(b) => onPickSignoff?.(b)} onRemove={(id) => onRemoveSignoff?.(id)} />
        <RichInput label="Sign-off line" value={doc.closing.signoff} onChange={(v) => dispatch({ type: 'setClosing', patch: { signoff: v } })} />
        <RichInput label="Name" value={doc.closing.name} onChange={(v) => dispatch({ type: 'setClosing', patch: { name: v } })} />
        <TextField label="Organisation" value={doc.closing.org} onChange={(v) => dispatch({ type: 'setClosing', patch: { org: v } })} />
        <TextField label="Mobile" value={doc.closing.mobile} onChange={(v) => dispatch({ type: 'setClosing', patch: { mobile: v } })} />
        <TextField label="Email" value={doc.closing.email} onChange={(v) => dispatch({ type: 'setClosing', patch: { email: v } })} />
      </SectionCard>

      <ConfirmDialog
        open={pendingRemove !== null}
        title="Remove a default clause?"
        message="This is one of the standard terms that ships with every quote. Removing it is unusual — continue?"
        confirmLabel="Remove clause"
        cancelLabel="Keep it"
        onCancel={() => setPendingRemove(null)}
        onConfirm={() => {
          if (pendingRemove !== null) remove(pendingRemove);
          setPendingRemove(null);
        }}
      />
    </div>
    </>
  );
}

function RowBtn({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  const base = 'inline-flex min-h-[2.75rem] min-w-[2.75rem] items-center justify-center rounded border text-sm disabled:opacity-40';
  const tone = danger ? 'border-red-300 text-red-700' : 'border-neutral-300 text-black hover:bg-neutral-100';
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className={`${base} ${tone}`}>
      {children}
    </button>
  );
}
