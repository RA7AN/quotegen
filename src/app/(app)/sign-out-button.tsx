/**
 * app/(app)/sign-out-button.tsx — client control for ending the Better Auth session.
 *
 * Calls `authClient.signOut()` (which clears the cookie via /api/auth) then routes the
 * visitor back to the public landing at `/` and refreshes so the server components see
 * the new (absent) session. No ConfirmDialog: sign-out is a plain, safe action with no
 * data loss, and AC-9 concerns are about alert()/confirm() only.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/auth/client';

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setBusy(true);
    try {
      await authClient.signOut();
    } finally {
      setBusy(false);
      router.push('/');
      router.refresh();
    }
  };

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={busy}
      className="rounded border border-band-ink/30 px-2.5 py-1 text-xs uppercase tracking-wide text-band-ink hover:border-gold-light hover:text-gold-light disabled:opacity-60"
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
