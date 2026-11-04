/**
 * app/(auth)/reset-password/page.tsx — complete a password reset (#9).
 *
 * Reads the `?token=` Better Auth emailed (via useSearchParams, so the form lives in a
 * <Suspense> boundary to keep the static prerender valid), validates the new password
 * inline, then calls resetPassword and routes back to sign-in.
 */

'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { authClient } from '@/auth/client';
import { authErrorMessage, extractResetToken, validatePassword } from '@/auth/forms';
import { FieldShell, inputClass } from '@/wizard/fields';

function ResetForm() {
  const router = useRouter();
  const token = extractResetToken(useSearchParams().get('token'));
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    const invalid = validatePassword(password);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(undefined);
    const res = await authClient.resetPassword({ newPassword: password, token });
    setBusy(false);
    const err = (res as { error?: unknown })?.error;
    if (err) {
      setError(authErrorMessage(err));
      return;
    }
    router.push('/sign-in');
  }

  if (!token) {
    return (
      <>
        <p role="alert" className="mt-4 text-sm font-medium text-red-700">
          This reset link is invalid or has expired. Request a new one.
        </p>
        <p className="mt-4 text-sm">
          <Link href="/forgot-password" className="font-semibold hover:underline">
            Request a new link
          </Link>
        </p>
      </>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
      <FieldShell label="New password" error={error} hint="At least 8 characters">
        <input
          className={inputClass}
          type="password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </FieldShell>
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
      >
        {busy ? 'Updating…' : 'Reset password'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-xl font-bold">Set a new password</h1>
      <Suspense fallback={null}>
        <ResetForm />
      </Suspense>
    </main>
  );
}
