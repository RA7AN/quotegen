/**
 * wizard/client-picker.tsx — the Step-1 saved-clients suggestion + Manage control (#11 slice 3).
 *
 * A disclosure listing the signed-in user's saved client profiles: "Use" patches the
 * current doc's client fields (autofill), and "Remove" deletes the stored row behind the
 * in-app ConfirmDialog (AC-9 — never a native confirm). Renders nothing when there are
 * no saved clients, so a first-time / anonymous / unconfigured run shows no empty chrome.
 * Purely presentational: every data mutation is a callback the wizard owns.
 */

'use client';

import { useState } from 'react';
import { ConfirmDialog } from './confirm-dialog';
import type { StoredClient } from './library';
import type { Client } from '@/domain/types';

export function ClientPicker({
  clients,
  onPick,
  onRemove,
}: {
  clients: StoredClient[];
  onPick: (client: Client) => void;
  onRemove: (id: string) => void;
}) {
  const [pending, setPending] = useState<StoredClient | null>(null);
  if (clients.length === 0) return null;

  return (
    <div className="space-y-2">
      <details className="rounded border border-neutral-200 bg-neutral-50 p-2">
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-muted">
          Saved clients ({clients.length}) — use or manage
        </summary>
        <ul className="mt-2 space-y-1">
          {clients.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{c.name || '(unnamed)'}</span>
                {c.custId ? <span className="ml-1 text-xs text-muted">· {c.custId}</span> : null}
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onPick(c.data)}
                  className="rounded bg-black px-2.5 py-1 text-xs font-medium text-white hover:bg-neutral-800"
                >
                  Use
                </button>
                <button
                  type="button"
                  onClick={() => setPending(c)}
                  aria-label={`Remove saved client ${c.name || c.id}`}
                  className="rounded border border-red-300 px-2.5 py-1 text-xs text-red-700 hover:bg-red-50"
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      </details>

      <ConfirmDialog
        open={pending !== null}
        title="Remove saved client?"
        message={`Delete “${pending?.name ?? ''}” from your saved clients? This does not affect any quote already created.`}
        confirmLabel="Remove"
        cancelLabel="Keep it"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) onRemove(pending.id);
          setPending(null);
        }}
      />
    </div>
  );
}
