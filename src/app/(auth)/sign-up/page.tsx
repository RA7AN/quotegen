/**
 * app/(auth)/sign-up/page.tsx — create an account (#9).
 *
 * Client component. Inline validation (AC-9), then Better Auth email+password
 * sign-up. Email verification is disabled for the MVP (see config), so a new
 * account is signed in immediately and routed into the wizard.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authClient } from '@/auth/client';
import { authErrorMessage, validateEmail, validateName, validatePassword } from '@/auth/forms';
import { FieldShell, inputClass } from '@/wizard/fields';

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fieldErrors = { name: validateName(name), email: validateEmail(email), password: validatePassword(password) };
    if (fieldErrors.name || fieldErrors.email || fieldErrors.password) {
      setErrors(fieldErrors);
      return;
    }
    setBusy(true);
    setErrors({});
    const { error } = await authClient.signUp.email({ name: name.trim(), email, password });
    setBusy(false);
    if (error) {
      setErrors({ form: authErrorMessage(error) });
      return;
    }
    router.push('/new');
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-xl font-bold">Create your account</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <FieldShell label="Name" error={errors.name}>
          <input
            className={inputClass}
            type="text"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </FieldShell>
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
        <FieldShell label="Password" error={errors.password} hint="At least 8 characters">
          <input
            className={inputClass}
            type="password"
            name="password"
            autoComplete="new-password"
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
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-4 text-sm">
        Already have an account?{' '}
        <Link href="/sign-in" className="font-semibold hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
