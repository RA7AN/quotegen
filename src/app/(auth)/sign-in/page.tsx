/**
 * app/(auth)/sign-in/page.tsx — email + password sign-in (#9).
 *
 * Client component. Validates inline (AC-9: no native dialogs), then calls the
 * Better Auth client. On success it routes to the signed-in dashboard at /home and
 * refreshes so server components re-read the new session cookie. A signed-in visitor
 * who lands here (e.g. via bookmark) is redirected by the /home layout itself.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authClient } from '@/auth/client';
import { authErrorMessage, validateEmail, validatePassword } from '@/auth/forms';
import { FieldShell, inputClass } from '@/wizard/fields';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fieldErrors = { email: validateEmail(email), password: validatePassword(password) };
    if (fieldErrors.email || fieldErrors.password) {
      setErrors(fieldErrors);
      return;
    }
    setBusy(true);
    setErrors({});
    const { error } = await authClient.signIn.email({ email, password });
    setBusy(false);
    if (error) {
      setErrors({ form: authErrorMessage(error) });
      return;
    }
    router.push('/home');
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-xl font-bold">Sign in</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <FieldShell label="Email" error={errors.email}>
          <input
            className={inputClass}
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FieldShell>
        <FieldShell label="Password" error={errors.password}>
          <input
            className={inputClass}
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FieldShell>
        {errors.form && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {errors.form}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <div className="mt-4 flex justify-between text-sm">
        <Link href="/forgot-password" className="text-muted hover:underline">
          Forgot password?
        </Link>
        <Link href="/sign-up" className="font-semibold hover:underline">
          Create account
        </Link>
      </div>
    </main>
  );
}
