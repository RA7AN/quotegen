/**
 * app/(marketing)/page.tsx — public landing (URL: `/`).
 *
 * Placeholder shell for slice 1 of the landing/auth-shell work: it makes the routing
 * contract real (anonymous visitors land here; the CTAs lead to sign-in/sign-up).
 * Slice 2 replaces the middle section with the full marketing hero, features grid,
 * and the inline clipart illustration.
 */

import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-3xl font-bold">Quotegen</h1>
      <p className="mt-2 max-w-prose text-sm text-muted">
        Deterministic quotation &amp; proforma PDFs, backed by a guided wizard. Sign in to
        start a new quote.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/sign-in"
          className="rounded bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
        >
          Sign in →
        </Link>
        <Link href="/sign-up" className="rounded border border-neutral-300 px-5 py-2.5 text-sm hover:bg-neutral-100">
          Create account
        </Link>
      </div>
    </main>
  );
}
