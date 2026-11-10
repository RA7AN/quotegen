/**
 * wizard/signoff-picker.tsx — the Step-3 saved sign-off block picker (#11 slice 4).
 *
 * Mirror of client-picker.tsx for the closing block: a disclosure listing the signed-in
 * user's saved sign-off blocks, where "Use" patches doc.closing (autofill) and "Remove"
 * deletes the stored row behind the in-app ConfirmDialog (AC-9 — never a native confirm).
 * Renders nothing when there are no saved blocks, so a first-time / anonymous /
 * unconfigured run shows no empty chrome. Purely presentational: the wizard owns every
 * data mutation via callbacks and reuses the library.ts seam shared with clients.
 */

'use client';

import { useState } from 'react';
import { ConfirmDialog } from './confirm-dialog';
import type { StoredSignoff } from './library';
import type { Closing } from '@/domain/types';

export function SignoffPicker({
  blocks,
  onPick,
  onRemove,
}: {
  blocks: StoredSignoff[];
  onPick: (block: Closing) => void;
  onRemove: (id: string) => void;
}) {
  const [pending, setPending] = useState<StoredSignoff | null>(null);
  if (blocks.length === 0) return null;

  return (
    <div className="space-y-2">
      <details className="rounded border border-neutral-200 bg-neutral-50 p-2">
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-muted">
          Saved sign-off blocks ({blocks.length}) — use or manage
        </summary>
        <ul className="mt-2 space-y-1">
          {blocks.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{b.label || b.data.name || '(unnamed)'}</span>
                {b.data.email ? <span className="ml-1 text-xs text-muted">· {b.data.email}</span> : null}
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onPick(b.data)}
                  className="rounded bg-black px-2.5 py-1 text-xs font-medium text-white hover:bg-neutral-800"
                >
                  Use
                </button>
                <button
                  type="button"
                  onClick={() => setPending(b)}
                  aria-label={`Remove saved sign-off block ${b.label || b.id}`}
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
        title="Remove saved sign-off block?"
        message={`Delete “${pending?.label || pending?.data.name || ''}” from your saved sign-off blocks? This does not affect any quote already created.`}
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
