/**
 * app/(auth)/layout.tsx — chrome for sign-in / sign-up / forgot-password / reset-password.
 *
 * Deliberately minimal: the wordmark links back to the landing so an anonymous visitor
 * who wandered here can exit, but there is no other nav — the form is the whole point.
 * Server component, no session read (these pages must render for anonymous users too).
 *
 * #49: one-row 56 px band with a 44 px exit link, and the content wrapper switched from
 * `100vh` to `100dvh` — on a phone browser `100vh` is the *large* viewport (URL bar included),
 * so the shell was always taller than what is visible and the page scrolled on its own.
 */

import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b-4 border-gold bg-band px-4 text-band-ink">
        <div className="mx-auto flex h-[3.25rem] max-w-5xl items-center justify-between">
          <Link href="/" className="flex min-h-[2.75rem] items-center text-sm font-bold uppercase tracking-widest">
            Quotegen
          </Link>
          <Link
            href="/"
            className="flex min-h-[2.75rem] items-center px-2 text-xs uppercase tracking-wide hover:text-gold-light"
          >
            ← Back to overview
          </Link>
        </div>
      </header>
      <div className="bg-panel min-h-[calc(100dvh-56px)]">{children}</div>
    </>
  );
}
