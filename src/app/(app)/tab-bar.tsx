/**
 * app/(app)/tab-bar.tsx — the phone-primary navigation for the signed-in shell (#49).
 *
 * The audit measured the old in-header nav at 390 px: six `text-xs uppercase` links with no
 * padding (HOME 37×16 … SETTINGS 61×16) wrapping the header to **128 px — 15 % of the
 * viewport** and none of them a touchable size. Six destinations also do not fit a thumb, so
 * the nav moves out of the header entirely:
 *
 *   Home · New quote · Quotes · More        (More → Drafts, Recent, Settings)
 *
 * A bottom tab bar is the standard answer on phones — thumb-reachable, one row, no wrap, no
 * horizontal scrolling to discover items — so the header collapses to brand + account. The
 * routes themselves are untouched: this is chrome, not an information-architecture change
 * (merging /quotes, /drafts and /recent into one segmented list stays a separate idea).
 *
 * `aria-current="page"` marks the active tab (and the More button stays marked while any of
 * its three sections is open). The sheet closes on navigation because this component lives in
 * the layout and therefore survives client-side route changes.
 */

'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useModal } from '@/ui/modal';

/** Always-visible tabs. Order is thumb-ergonomic, not alphabetical. */
const TABS: ReadonlyArray<{ href: string; label: string; icon: 'home' | 'new' | 'list' }> = [
  { href: '/home', label: 'Home', icon: 'home' },
  { href: '/new', label: 'New quote', icon: 'new' },
  { href: '/quotes', label: 'Quotes', icon: 'list' },
];

/** Everything else, one tap deeper. Routes unchanged. */
const MORE: ReadonlyArray<{ href: string; label: string; hint: string }> = [
  { href: '/drafts', label: 'Drafts', hint: 'Saved work in progress' },
  { href: '/recent', label: 'Recent', hint: 'Re-renderable documents' },
  { href: '/settings', label: 'Settings', hint: 'Company profile & libraries' },
];

function Icon({ name }: { name: 'home' | 'new' | 'list' | 'more' }) {
  const paths: Record<'home' | 'new' | 'list' | 'more', ReactNode> = {
    home: <path d="M4 10.5 12 4l8 6.5V20H14v-5h-4v5H4z" />,
    new: <path d="M12 5v14M5 12h14" />,
    list: <path d="M4 6h16M4 12h16M4 18h11" />,
    more: (
      <>
        <circle cx="5" cy="12" r="1.6" />
        <circle cx="12" cy="12" r="1.6" />
        <circle cx="19" cy="12" r="1.6" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}

export function TabBar() {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const sheetRef = useModal<HTMLDivElement>(more, () => setMore(false));

  // A tab press inside the sheet navigates; this component never unmounts, so clear the
  // open state ourselves or the sheet would follow the user into the next page.
  useEffect(() => setMore(false), [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  const moreActive = MORE.some((m) => isActive(m.href));
  const tabClass = (active: boolean) =>
    `flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-1 rounded-none text-[11px] uppercase tracking-wide ${
      active ? 'font-bold text-gold' : 'font-medium text-muted'
    }`;

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-panel pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto flex max-w-5xl items-stretch">
          {TABS.map((t) => {
            const active = isActive(t.href);
            return (
              <li key={t.href} className="flex flex-1">
                <Link href={t.href} aria-current={active ? 'page' : undefined} className={tabClass(active)}>
                  <Icon name={t.icon} />
                  {t.label}
                </Link>
              </li>
            );
          })}
          <li className="flex flex-1">
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={more}
              aria-current={moreActive ? 'page' : undefined}
              onClick={() => setMore(true)}
              className={tabClass(moreActive)}
            >
              <Icon name="more" />
              More
            </button>
          </li>
        </ul>
      </nav>

      {more && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-end justify-center bg-band/50 sm:items-center sm:p-4"
          onPointerDown={() => setMore(false)}
        >
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="More sections"
            tabIndex={-1}
            onPointerDown={(e) => e.stopPropagation()}
            className="max-h-[80svh] w-full overflow-y-auto rounded-t-2xl border border-neutral-300 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg outline-none sm:max-w-sm sm:rounded-lg"
          >
            <h2 className="px-1 text-xs font-bold uppercase tracking-wide text-muted">More</h2>
            <ul className="mt-1">
              {MORE.map((m) => (
                <li key={m.href}>
                  <Link
                    href={m.href}
                    aria-current={isActive(m.href) ? 'page' : undefined}
                    className="flex min-h-[3rem] items-center justify-between gap-3 rounded-lg px-3 text-left hover:bg-neutral-100"
                  >
                    <span className="min-w-0">
                      <span className="block text-base font-medium">{m.label}</span>
                      <span className="block truncate text-xs text-muted">{m.hint}</span>
                    </span>
                    <span aria-hidden="true" className="shrink-0 text-lg text-muted">
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setMore(false)}
              className="mt-3 min-h-[2.75rem] w-full rounded border border-neutral-400 text-base sm:text-sm hover:bg-neutral-100"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
