/**
 * app/(app)/quotes/quotes-view.tsx — saved-snapshot list body (FR-6.2 / AC-13, HP-4).
 *
 * Client body mounted by the sibling `page.tsx` server wrapper (which owns the session
 * guard). Open seeds the snapshot into the draft and routes to /new (the wizard's
 * resume banner picks it up). Duplicate makes an independent copy under a fresh id;
 * Delete removes the entry. All operations go through the storage codec, which skips
 * unreadable entries instead of crashing (EC-11).
 *
 * #49: Delete used to be a 63×26 button that removed the snapshot on the first tap — no
 * dialog, no undo, while drafts and settings profiles both confirm. It now routes through
 * the shared ConfirmDialog (naming the quote) and the whole row is the Open control with 44 px
 * secondary actions, matching the other two lists. This is a data-loss fix, not polish: saved
 * quotes are the only artefact here carrying a document number.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserKV, deleteQuote, duplicateQuote, listQuotes, openQuoteAsDraft } from '@/lib/storage';
import { ConfirmDialog } from '@/wizard/confirm-dialog';
import type { SavedQuote } from '@/lib/storage';

export function QuotesView() {
  const router = useRouter();
  const [quotes, setQuotes] = useState(() => listQuotes(browserKV()));
  const [pendingDelete, setPendingDelete] = useState<SavedQuote | null>(null);

  const open = (id: string) => {
    if (openQuoteAsDraft(browserKV(), id)) router.push('/new');
  };
  const duplicate = (id: string) => {
    const source = quotes.find((q) => q.id === id);
    if (!source) return;
    duplicateQuote(browserKV(), id, {
      newId: crypto.randomUUID(),
      name: `Copy of ${source.name}`,
      savedAtISO: new Date().toISOString(),
    });
    setQuotes(listQuotes(browserKV()));
  };
  const remove = (id: string) => {
    setPendingDelete(null);
    setQuotes(deleteQuote(browserKV(), id));
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-4 text-xl font-bold">Saved quotes</h1>
      {quotes.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-300 p-6 text-sm text-muted">
          Nothing saved yet. Finish a quote in the wizard and press <strong>Save quote</strong>.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
          {quotes.map((q) => (
            <li key={q.id} className="px-2 py-2 sm:px-4 sm:py-3">
              <button
                type="button"
                onClick={() => open(q.id)}
                aria-label={`Open ${q.name}`}
                className="flex min-h-[3rem] w-full items-center justify-between gap-3 rounded text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate text-base font-medium">{q.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {q.doc.template === 'proforma' ? 'Proforma' : 'Quotation'} · {q.doc.meta.docNo || '—'}
                    {q.savedAtISO && ` · saved ${q.savedAtISO.slice(0, 10)}`}
                  </span>
                </span>
                <span aria-hidden="true" className="shrink-0 text-lg text-muted">
                  ›
                </span>
              </button>
              <div className="mt-1 flex gap-3">
                <button
                  type="button"
                  onClick={() => duplicate(q.id)}
                  className="min-h-[2.75rem] rounded border border-neutral-400 px-4 text-sm hover:bg-neutral-100"
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(q)}
                  className="min-h-[2.75rem] rounded border border-red-300 px-4 text-sm text-red-700 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this saved quote?"
        message={`“${pendingDelete?.name ?? ''}” will be removed from this browser. The PDF you exported is unaffected, but the saved inputs cannot be recovered.`}
        confirmLabel="Delete"
        onConfirm={() => pendingDelete && remove(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
      />
    </main>
  );
}
