/**
 * documents/recent-documents.tsx — "Recent documents" surface (#12 slice 2).
 *
 * Lists the signed-in user's stored documents (GET /api/documents) and re-renders any
 * one on demand: fetch the row → rehydrate { doc, profile } → renderToBlob, then
 * Download (anchor) or Open (new tab). This is the wizard's own export path reused, so
 * a reopened PDF is byte-identical to the original (AC-6/EC-14). Reads are session-
 * scoped; a 401 degrades to a "sign in" prompt (no native alert — AC-9) rather than a
 * crash, and a per-row render failure only sets an inline notice.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { registerFonts } from '@/pdf/theme';
import { renderToBlob } from '@/pdf/index';
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
  const blobUrl = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/documents');
        if (res.status === 401) {
          if (!cancelled) setError('Sign in to see your recent documents.');
          return;
        }
        if (!res.ok) {
          if (!cancelled) setError('Could not load recent documents.');
          return;
        }
        const data = (await res.json()) as { items?: unknown };
        if (!cancelled) setItems(Array.isArray(data.items) ? (data.items as Summary[]) : []);
      } catch {
        if (!cancelled) setError('Could not load recent documents.');
      }
    })();
    return () => {
      cancelled = true;
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    };
  }, []);

  // Re-render a stored row to a fresh object URL; returns the URL + download filename,
  // or null after surfacing an inline error.
  async function buildUrl(id: string): Promise<{ url: string; filename: string } | null> {
    setBusyId(id);
    setError(null);
    try {
      const input = await rehydrateById(id);
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
          {items.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <p className="text-sm font-medium">
                  {d.number || 'Untitled'}
                  {d.clientName ? ` · ${d.clientName}` : ''}
                </p>
                <p className="text-xs text-muted">
                  {d.kind === 'proforma' ? 'Proforma' : 'Quotation'} · {d.createdAt.slice(0, 10)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId === d.id}
                  onClick={() => void open(d.id)}
                  className="rounded border border-neutral-400 px-3 py-1 text-xs disabled:opacity-50"
                >
                  Open
                </button>
                <button
                  type="button"
                  disabled={busyId === d.id}
                  onClick={() => void download(d.id)}
                  className="rounded bg-black px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                >
                  {busyId === d.id ? 'Rendering…' : 'Download'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
