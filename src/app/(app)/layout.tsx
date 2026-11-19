/**
 * app/(app)/layout.tsx — authenticated app shell + session guard.
 *
 * Every route under this group (`/home`, `/new`, `/quotes`, `/drafts`, `/recent`, `/settings`) is
 * user-scoped: an anonymous visitor is redirected to `/sign-in` before any child renders.
 * `headers()` is read unconditionally so Next.js marks the subtree dynamic at build time
 * (rather than baking a prerendered signed-out HTML snapshot), which is what we want for
 * a serverful deploy where auth creds are set per-environment.
 *
 * The chrome below is the "app nav" (#49). Six `text-xs uppercase` links in the band wrapped
 * the header to 128 px — 15 % of a 390 × 844 viewport — with every link 16 px tall, so the
 * destinations moved to a fixed bottom tab bar (Home / New quote / Quotes / More) and the band
 * keeps only the brand and the ☰ account menu, one row, 56 px. The band is deliberately NOT
 * sticky: the tab bar is the persistent nav, and a sticky header would keep stealing the
 * vertical space the audit flagged on the wizard and `/settings`. Routes are unchanged.
 */

import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/auth/session';
import { isSetupComplete } from '@/db/profiles';
import { AccountMenu } from './account-menu';
import { TabBar } from './tab-bar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Always call headers() so this layout opts into per-request rendering even before
  // a session exists; getSessionUser then reads the same headers without a second hop.
  const h = await headers();
  const user = await getSessionUser(h);
  if (!user) redirect('/sign-in');

  // First-run gate (#37): a signed-in account that has never finished business setup is
  // bounced to /onboarding (its own route group, so this layout never needs to path-exclude
  // a child and loop). `isSetupComplete` degrades open when the DB is unconfigured/errors,
  // so preview and pre-migration environments are never locked out.
  if (!(await isSetupComplete(user.id))) redirect('/onboarding');

  return (
    <>
      {/* The band uses the non-inverting brand tokens: it stays black/gold in dark mode. */}
      <header className="border-b-4 border-gold bg-band px-4 text-band-ink">
        <div className="mx-auto flex h-[3.25rem] max-w-5xl items-center justify-between">
          <Link
            href="/home"
            className="flex min-h-[2.75rem] items-center text-sm font-bold uppercase tracking-widest"
          >
            Quotegen
          </Link>
          {/* Email + theme + sign-out stay collapsed behind one ☰ account menu. */}
          <nav aria-label="Account" className="flex items-center">
            <AccountMenu email={user.email} />
          </nav>
        </div>
      </header>
      {/* Bottom clearance for the fixed tab bar (+ its safe-area inset). */}
      <div className="pb-[calc(4rem+env(safe-area-inset-bottom))]">{children}</div>
      <TabBar />
    </>
  );
}
