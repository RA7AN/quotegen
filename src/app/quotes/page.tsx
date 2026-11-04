/**
 * app/quotes/page.tsx — saved-snapshot list (FR-6.2 / AC-13, HP-4).
 *
 * Open seeds the snapshot into the draft and routes to /new (the wizard's resume banner
 * picks it up). Duplicate makes an independent copy under a fresh id; Delete removes
 * the entry. All operations go through the storage codec, which skips unreadable
 * entries instead of crashing (EC-11).
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserKV, deleteQuote, duplicateQuote, listQuotes, openQuoteAsDraft } from '@/lib/storage';

export default function QuotesPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState(() => listQuotes(browserKV()));

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
            <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <p className="text-sm font-medium">{q.name}</p>
                <p className="text-xs text-muted">
                  {q.doc.template === 'proforma' ? 'Proforma' : 'Quotation'} · {q.doc.meta.docNo || '—'}
                  {q.savedAtISO && ` · saved ${q.savedAtISO.slice(0, 10)}`}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => open(q.id)} className="rounded bg-black px-3 py-1 text-xs font-medium text-white">
                  Open
                </button>
                <button type="button" onClick={() => duplicate(q.id)} className="rounded border border-neutral-400 px-3 py-1 text-xs">
                  Duplicate
                </button>
                <button type="button" onClick={() => remove(q.id)} className="rounded border border-red-300 px-3 py-1 text-xs text-red-700">
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
