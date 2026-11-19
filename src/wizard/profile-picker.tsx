/**
 * wizard/profile-picker.tsx — the per-quote company-profile picker (#31 part 1).
 *
 * Lets the user render THIS quote from any saved library profile without changing the
 * account default — "apply one of our liking for each quote". Mirrors ClientPicker: a
 * disclosure that renders nothing when the account has no saved profiles (a first-time /
 * anonymous run shows no empty chrome), and is purely presentational — the wizard owns the
 * async fetch/apply + persistence of the pick.
 *
 * `currentId` is the id of the profile currently feeding the preview, or null when the
 * account default is in use; that row is marked "In use" and a reset appears once the user
 * has deviated from the default. No native dialogs (AC-9).
 */

'use client';

import type { StoredProfileSummary } from './library';

export function ProfilePicker({
  profiles,
  currentId,
  onUse,
  onResetToDefault,
}: {
  profiles: StoredProfileSummary[];
  currentId: string | null;
  onUse: (id: string) => void;
  onResetToDefault: () => void;
}) {
  if (profiles.length === 0) return null;
  const current = profiles.find((p) => p.id === currentId) ?? null;

  return (
    <details className="rounded border border-neutral-200 bg-neutral-50 p-2" open={current !== null}>
      <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-muted">
        Letterhead profile — {current ? `“${current.name || '(unnamed)'}”` : 'account default'} · {profiles.length} saved
      </summary>
      <p className="mt-2 text-xs text-muted">
        Pick which company profile prints on this quote. Only affects this document — your
        account default stays the same, and the choice is remembered if you reload.
      </p>
      <ul className="mt-2 space-y-1">
        {profiles.map((p) => {
          const inUse = p.id === currentId;
          return (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{p.name || '(unnamed)'}</span>
                {p.isDefault ? <span className="ml-1 rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">Default</span> : null}
              </span>
              {inUse ? (
                <span className="text-xs font-medium text-green-700">In use</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onUse(p.id)}
                  className="inline-flex min-h-[2.75rem] items-center rounded bg-black px-3 text-sm font-medium text-white hover:bg-neutral-800"
                >
                  Use for this quote
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {currentId !== null && (
        <button
          type="button"
          onClick={onResetToDefault}
          className="mt-2 inline-flex min-h-[2.75rem] items-center rounded px-2 text-sm underline text-muted hover:text-black"
        >
          Use account default instead
        </button>
      )}
    </details>
  );
}
