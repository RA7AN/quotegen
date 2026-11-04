/**
 * app/(auth)/forgot-password/page.tsx — request a reset link (#9).
 *
 * Client component. Calls Better Auth's forget-password, which emails a reset URL
 * (rendered by our Resend sender) pointing at /reset-password?token=… Always shows a
 * neutral success note so the form doesn't leak whether an account exists.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authClient } from '@/auth/client';
import { authErrorMessage, validateEmail } from '@/auth/forms';
import { FieldShell, inputClass } from '@/wizard/fields';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const invalid = validateEmail(email);
    if (invalid) {
      setError(invalid);
      setSent(false);
      return;
    }
    setBusy(true);
    setError(undefined);
    const res = (await authClient.forgetPassword({ email, redirectTo: '/reset-password' })) as {
      error?: unknown;
    };
    setBusy(false);
    if (res?.error) {
      setError(authErrorMessage(res.error));
      setSent(false);
      return;
    }
    setSent(true);
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-xl font-bold">Forgot password</h1>
      <p className="mt-2 text-sm text-muted">Enter your email and we&apos;ll send a reset link.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <FieldShell label="Email" error={error}>
          <input
            className={inputClass}
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FieldShell>
        {sent && (
          <p role="status" aria-live="polite" className="text-sm font-medium text-green-700">
            If an account exists for that address, a reset link is on its way.
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <p className="mt-4 text-sm">
        <Link href="/sign-in" className="font-semibold hover:underline">
          ← Back to sign in
        </Link>
      </p>
    </main>
  );
}
