/**
 * app/(app)/account-menu.tsx — the nav band's account dropdown (hamburger-style).
 *
 * Collapses the three per-user controls that used to sit loose in the header —
 * the signed-in email, the dark/light toggle, and Sign out — behind one ☰ button.
 * Plain disclosure semantics (aria-expanded + a grouped panel), closed by an outside
 * pointer press or Escape; no native dialogs anywhere (AC-9). Server layout passes the
 * session email down as a prop; the children keep their own logic (KEYS.theme
 * persistence, authClient.signOut).
 *
 * #49 fixes for phones: the panel used to be `absolute right-0 w-60` under a nav that had
 * wrapped, so it measured x = −107 → 133 and 45 % of it sat off-screen. The band is now one
 * row with ☰ pinned right, and the panel additionally clamps to the viewport width. Outside
 * dismissal moved from `mousedown` (a compatibility event on touch — suppressed by scroll
 * gestures and double-tap-zoom) to `pointerdown`, and a resize/rotation now closes the panel
 * instead of leaving it anchored where it no longer fits.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { ThemeToggle } from '../theme-toggle';
import { SignOutButton } from './sign-out-button';

export function AccountMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // Dismiss on an outside pointer press (touch-safe), Escape, or a viewport resize.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    // Rotation/resize can leave a right-anchored panel where it no longer fits — close it.
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
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
        className="inline-flex min-h-[2.75rem] min-w-[2.75rem] items-center justify-center rounded border border-band-ink/30 px-2 text-base hover:border-gold-light hover:text-gold-light"
      >
        <span aria-hidden="true">☰</span>
      </button>

      {open && (
        <div
          role="group"
          aria-label="Account"
          className="absolute right-0 top-full z-40 mt-2 w-60 max-w-[calc(100vw-2rem)] rounded-lg border border-neutral-200 bg-white p-2 shadow-lg"
        >
          <p className="break-all px-2 py-1 text-xs text-muted">{email}</p>
          <div aria-hidden className="my-1 border-t border-neutral-200" />
          <ThemeToggle inMenu />
          <SignOutButton menuItem />
        </div>
      )}
    </div>
  );
}
