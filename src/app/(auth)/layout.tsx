/**
 * app/(auth)/layout.tsx — chrome for sign-in / sign-up / forgot-password / reset-password.
 *
 * Deliberately minimal: the wordmark links back to the landing so an anonymous visitor
 * who wandered here can exit, but there is no other nav — the form is the whole point.
 * Server component, no session read (these pages must render for anonymous users too).
 */

import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b-4 border-gold bg-black px-4 py-3 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="text-sm font-bold uppercase tracking-widest">
            Quotegen
          </Link>
          <Link href="/" className="text-xs uppercase tracking-wide hover:text-gold-light">
            ← Back to overview
          </Link>
        </div>
      </header>
      <div className="bg-panel min-h-[calc(100vh-56px)]">{children}</div>
    </>
  );
}
