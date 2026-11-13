/**
 * app/(marketing)/layout.tsx — public shell for the landing page.
 *
 * Server component. Reads no session (so the marketing page stays prerenderable static)
 * and ships the same black/gold band as the rest of the app, but with a signed-out
 * CTA pair (Sign in / Create account) instead of the app nav. The wordmark is a link
 * home so a signed-in visitor who lands here can navigate back without hitting
 * browser-back.
 */

import Link from 'next/link';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b-4 border-gold bg-band px-4 py-3 text-band-ink">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="text-sm font-bold uppercase tracking-widest">
            Quotegen
          </Link>
          <nav aria-label="Primary" className="flex items-center gap-4 text-xs uppercase tracking-wide">
            <Link href="/sign-in" className="hover:text-gold-light">
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded bg-band-ink px-3 py-1.5 font-semibold text-band hover:bg-gold-light hover:text-band"
            >
              Create account
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="mt-16 border-t border-neutral-200 bg-panel px-4 py-6 text-xs text-muted">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} Quotegen · Encompass Design &amp; Build / Elaf Al Yamamah</span>
          <span className="uppercase tracking-wide">Deterministic PDFs · Zero manual formatting</span>
        </div>
      </footer>
    </>
  );
}
