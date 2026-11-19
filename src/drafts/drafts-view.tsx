/**
 * drafts/drafts-view.tsx — the /drafts list body (multi-drafts slice).
 *
 * Client component mounted by the sibling page wrapper (the (app) layout already
 * guards the session). Lists the user's server-backed drafts, freshest first, with
 * Open (deep-links the wizard at /new?draft=<id>) and Delete (in-app ConfirmDialog,
 * never window.confirm — AC-9). Reads ride the best-effort wizard/library seam, so
 * an unreachable API simply shows the empty state instead of crashing.
 *
 * #49 row anatomy: same change as RecentDocuments — the draft title is the whole-row 48 px
 * Open control and Delete is a 44 px button below it, replacing a 55×26 link beside a 63×26
 * button. The "+ New quote" CTA is 44 px too.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchDrafts, removeDraft, type StoredDraftSummary } from '@/wizard/library';
import { ConfirmDialog } from '@/wizard/confirm-dialog';
import { FloatingToast, FloatingToastStack } from '@/wizard/fields';

export function DraftsView() {
  const [items, setItems] = useState<StoredDraftSummary[] | null>(null); // null = loading
  const [notice, setNotice] = useState('');
  const [pendingDelete, setPendingDelete] = useState<StoredDraftSummary | null>(null);

  const load = useCallback(async () => {
    setItems(await fetchDrafts());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Success/error toasts fade after 5 s; deletions otherwise speak for themselves.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 5_000);
    return () => clearTimeout(t);
  }, [notice]);

  const confirmDelete = async (): Promise<void> => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    const ok = await removeDraft(target.id);
    setNotice(ok ? `Deleted draft “${target.name}”.` : 'Could not delete that draft.');
    if (ok) void load();
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Drafts</h1>
        <Link
          href="/new"
          className="inline-flex min-h-[2.75rem] items-center rounded-lg bg-black px-4 text-sm font-semibold text-white hover:bg-neutral-800"
        >
          + New quote
        </Link>
      </div>

      {items === null ? (
        <p className="rounded border border-dashed border-neutral-300 p-6 text-sm text-muted">Loading drafts…</p>
      ) : items.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-300 p-6 text-sm text-muted">
          No drafts yet. Fill in any quote form and press <strong>Save draft</strong> — it will wait for you here,
          even after you close the tab.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
          {items.map((d) => (
            <li key={d.id} className="px-2 py-2 sm:px-4 sm:py-3">
              <Link
                href={`/new?draft=${encodeURIComponent(d.id)}`}
                aria-label={`Open draft ${d.name}`}
                className="flex min-h-[3rem] w-full items-center justify-between gap-3 rounded text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate text-base font-medium">{d.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {d.kind === 'proforma' ? 'Proforma' : 'Quotation'} · step {d.step} of 4 · {d.updatedAt.slice(0, 10)}
                  </span>
                </span>
                <span aria-hidden="true" className="shrink-0 text-lg text-muted">
                  ›
                </span>
              </Link>
              <div className="mt-1 flex gap-3">
                <button
                  type="button"
                  onClick={() => setPendingDelete(d)}
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
        title="Delete draft?"
        message={`“${pendingDelete?.name ?? ''}” will be removed. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />

      {notice && (
        <FloatingToastStack>
          <FloatingToast message={notice} variant="success" onDismiss={() => setNotice('')} />
        </FloatingToastStack>
      )}
    </main>
  );
}
