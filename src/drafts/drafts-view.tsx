/**
 * drafts/drafts-view.tsx — the /drafts list body (multi-drafts slice).
 *
 * Client component mounted by the sibling page wrapper (the (app) layout already
 * guards the session). Lists the user's server-backed drafts, freshest first, with
 * Open (deep-links the wizard at /new?draft=<id>) and Delete (in-app ConfirmDialog,
 * never window.confirm — AC-9). Reads ride the best-effort wizard/library seam, so
 * an unreachable API simply shows the empty state instead of crashing.
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
          className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
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
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{d.name}</p>
                <p className="text-xs text-muted">
                  {d.kind === 'proforma' ? 'Proforma' : 'Quotation'} · step {d.step} of 4 · {d.updatedAt.slice(0, 10)}
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/new?draft=${encodeURIComponent(d.id)}`}
                  className="rounded bg-black px-3 py-1 text-xs font-medium text-white hover:bg-neutral-800"
                >
                  Open
                </Link>
                <button
                  type="button"
                  onClick={() => setPendingDelete(d)}
                  className="rounded border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50"
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
