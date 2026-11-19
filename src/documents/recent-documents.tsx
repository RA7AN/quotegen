/**
 * documents/recent-documents.tsx — "Recent documents" surface (#12 slice 2).
 *
 * Lists the signed-in user's stored documents (GET /api/documents) and re-renders any
 * one on demand: fetch the row → rehydrate { doc, profile } → renderToBlob, then
 * Download (anchor) or Open (new tab). This is the wizard's own export path reused, so
 * a reopened PDF is byte-identical to the original (AC-6/EC-14). Reads are session-
 * scoped; a 401 degrades to a "sign in" prompt (no native alert — AC-9) rather than a
 * crash, and a per-row render failure only sets an inline notice.
 *
 * #49 row anatomy: at 390 px the old row was three `px-3 py-1 text-xs` buttons (Open 56×26,
 * Download 81×26, Remove 71×26) with the row itself inert — the obvious tap target did
 * nothing. The document title is now the whole-row primary control (48 px, opens the PDF) and
 * the two secondary actions are 44 px buttons underneath, so a thumb aims at one big target
 * instead of three 26 px slivers.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { registerFonts } from '@/pdf/theme';
import { renderToBlob } from '@/pdf/index';
import { ConfirmDialog } from '@/wizard/confirm-dialog';
import { fetchProfile, type ProfileAssetPair } from '@/wizard/library';
import { rehydrateById } from './rerender';

// Browser font registration (bundled TTFs at /fonts/*), idempotent — same as the wizard.
registerFonts((file) => `/fonts/${file}`);

type Summary = {
  id: string;
  kind: string;
  number: string | null;
  clientName: string | null;
  createdAt: string;
};

export function RecentDocuments() {
  const [items, setItems] = useState<Summary[] | null>(null); // null = loading
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Summary | null>(null);
  // #38: the account's server-sourced brand marks, layered onto re-renders so a reopened
  // PDF matches the marks the user has on any device. null (anonymous / not yet loaded) →
  // rehydrateById falls back to the device-local slot, unchanged.
  const [markOverrides, setMarkOverrides] = useState<ProfileAssetPair | null>(null);
  const blobUrl = useRef<string | null>(null);

  // Load (or reload) the user's stored documents. Shared by mount and post-delete refresh.
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.status === 401) {
        setError('Sign in to see your recent documents.');
        return;
      }
      if (!res.ok) {
        setError('Could not load recent documents.');
        return;
      }
      const data = (await res.json()) as { items?: unknown };
      setItems(Array.isArray(data.items) ? (data.items as Summary[]) : []);
    } catch {
      setError('Could not load recent documents.');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!cancelled) await load();
    })();
    // Best-effort, session-checked: fetchProfile makes zero calls when signed out.
    void fetchProfile().then((sp) => {
      if (!cancelled && sp) setMarkOverrides(sp.assets);
    });
    return () => {
      cancelled = true;
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    };
  }, [load]);

  // Re-render a stored row to a fresh object URL; returns the URL + download filename,
  // or null after surfacing an inline error.
  async function buildUrl(id: string): Promise<{ url: string; filename: string } | null> {
    setBusyId(id);
    setError(null);
    try {
      const input = await rehydrateById(id, fetch, markOverrides);
      if (!input) {
        setError('That document could not be reopened.');
        return null;
      }
      const { blob, filename } = await renderToBlob(input);
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
      blobUrl.current = URL.createObjectURL(blob);
      return { url: blobUrl.current, filename };
    } catch {
      setError('That document could not be reopened.');
      return null;
    } finally {
      setBusyId(null);
    }
  }

  async function download(id: string) {
    const built = await buildUrl(id);
    if (!built) return;
    const a = document.createElement('a');
    a.href = built.url;
    a.download = built.filename;
    a.click();
  }

  async function open(id: string) {
    const built = await buildUrl(id);
    if (built) window.open(built.url, '_blank', 'noopener');
  }

  // Delete a confirmed row (user-scoped at the endpoint), then refresh the list.
  async function confirmDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) setError('Could not remove that document.');
      await load();
    } catch {
      setError('Could not remove that document.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-1 text-xl font-bold">Recent documents</h1>
      <p className="mb-4 text-sm text-muted">
        Generated quotations and proforma invoices are re-rendered on demand from your saved inputs.
      </p>

      {error && (
        <p className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {items === null ? (
        <p className="rounded border border-dashed border-neutral-300 p-6 text-sm text-muted">Loading…</p>
      ) : items.length === 0 ? (
        !error && (
          <p className="rounded border border-dashed border-neutral-300 p-6 text-sm text-muted">
            Nothing stored yet. Generate and download a document in the wizard to see it here.
          </p>
        )
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
          {items.map((d) => {
            const title = `${d.number || 'Untitled'}${d.clientName ? ` · ${d.clientName}` : ''}`;
            return (
              <li key={d.id} className="px-2 py-2 sm:px-4 sm:py-3">
                <button
                  type="button"
                  disabled={busyId === d.id}
                  onClick={() => void open(d.id)}
                  aria-label={`Open ${title}`}
                  className="flex min-h-[3rem] w-full items-center justify-between gap-3 rounded text-left disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-base font-medium">{d.number || 'Untitled'}</span>
                    <span className="block truncate text-xs text-muted">
                      {d.kind === 'proforma' ? 'Proforma' : 'Quotation'} · {d.createdAt.slice(0, 10)}
                      {d.clientName ? ` · ${d.clientName}` : ''}
                    </span>
                  </span>
                  <span aria-hidden="true" className="shrink-0 text-lg text-muted">
                    ›
                  </span>
                </button>
                <div className="mt-1 flex gap-3">
                  <button
                    type="button"
                    disabled={busyId === d.id}
                    onClick={() => void download(d.id)}
                    className="min-h-[2.75rem] rounded bg-black px-4 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {busyId === d.id ? 'Rendering…' : 'Download'}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === d.id}
                    onClick={() => setPendingDelete(d)}
                    className="min-h-[2.75rem] rounded border border-red-300 px-4 text-sm text-red-700 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove this document?"
        message={`“${pendingDelete?.number || 'Untitled'}” will be deleted from your recent documents. This cannot be undone.`}
        confirmLabel="Remove"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </main>
  );
}
