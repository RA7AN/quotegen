/**
 * app/(app)/layout.tsx — authenticated app shell + session guard.
 *
 * Every route under this group (`/home`, `/new`, `/quotes`, `/recent`, `/settings`) is
 * user-scoped: an anonymous visitor is redirected to `/sign-in` before any child renders.
 * `headers()` is read unconditionally so Next.js marks the subtree dynamic at build time
 * (rather than baking a prerendered signed-out HTML snapshot), which is what we want for
 * a serverful deploy where auth creds are set per-environment.
 *
 * The chrome below is the "app nav" (Home / New quote / Quotes / Recent / Settings +
 * Sign out). It replaces what used to live on the root layout, so marketing and auth
 * routes keep their own quieter headers.
 */

import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/auth/session';
import { SignOutButton } from './sign-out-button';
import { ThemeToggle } from '../theme-toggle';

const NAV: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/home', label: 'Home' },
  { href: '/new', label: 'New quote' },
  { href: '/quotes', label: 'Quotes' },
  { href: '/recent', label: 'Recent' },
  { href: '/settings', label: 'Settings' },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Always call headers() so this layout opts into per-request rendering even before
  // a session exists; getSessionUser then reads the same headers without a second hop.
  const h = await headers();
  const user = await getSessionUser(h);
  if (!user) redirect('/sign-in');

  return (
    <>
      {/* The band uses the non-inverting brand tokens: it stays black/gold in dark mode. */}
      <header className="border-b-4 border-gold bg-band px-4 py-3 text-band-ink">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
          <Link href="/home" className="text-sm font-bold uppercase tracking-widest">
            Quotegen
          </Link>
          <nav aria-label="Primary" className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-wide">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-gold-light">
                {n.label}
              </Link>
            ))}
            <ThemeToggle />
            <span aria-hidden className="text-band-muted">·</span>
            <span className="hidden truncate text-xs normal-case tracking-normal text-band-muted sm:inline" title={user.email}>
              {user.email}
            </span>
            <SignOutButton />
          </nav>
        </div>
      </header>
      {children}
    </>
  );
}
