/**
 * app/(app)/account-menu.tsx — the nav band's account dropdown (hamburger-style).
 *
 * Collapses the three per-user controls that used to sit loose in the header —
 * the signed-in email, the dark/light toggle, and Sign out — behind one ☰ button
 * so the nav stays compact on small screens. Plain disclosure semantics
 * (aria-expanded + a grouped panel), closed by outside click or Escape; no native
 * dialogs anywhere (AC-9). Server layout passes the session email down as a prop;
 * the children keep their own logic (KEYS.theme persistence, authClient.signOut).
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { ThemeToggle } from '../theme-toggle';
import { SignOutButton } from './sign-out-button';

export function AccountMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // Dismiss on outside mousedown or Escape while the panel is up.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Account menu"
        title="Account"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-[2.5rem] min-w-[2.5rem] items-center justify-center rounded border border-band-ink/30 px-2 text-sm hover:border-gold-light hover:text-gold-light"
      >
        <span aria-hidden="true">☰</span>
      </button>

      {open && (
        <div
          role="group"
          aria-label="Account"
          className="absolute right-0 top-full z-40 mt-2 w-60 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg"
        >
          <p className="truncate px-2 py-1 text-xs text-muted" title={email}>
            {email}
          </p>
          <div aria-hidden className="my-1 border-t border-neutral-200" />
          <ThemeToggle inMenu />
          <SignOutButton menuItem />
        </div>
      )}
    </div>
  );
}
