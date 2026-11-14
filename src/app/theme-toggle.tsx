/**
 * app/theme-toggle.tsx — platform-wide light/dark switch, rendered in the nav band.
 *
 * The theme itself is a `dark` class on <html> driven entirely by the CSS variable
 * overrides in globals.css (:root.dark). A tiny inline script in the root layout
 * applies the saved (or system) preference before first paint, so this component
 * only has to mirror the current state for the button and persist new choices.
 *
 * Preference values: 'light' | 'dark' saved under KEYS.theme; absence means
 * "follow the system". The first explicit toggle always writes a concrete value.
 */

'use client';

import { useEffect, useState } from 'react';
import { KEYS } from '@/lib/storage';

export function ThemeToggle({ inMenu = false }: { inMenu?: boolean }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Sync with whatever the pre-paint script chose (avoids hydration mismatch).
  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    try {
      localStorage.setItem(KEYS.theme, next);
    } catch {
      /* storage unavailable — the switch still applies for this page load */
    }
  };

  // Inside the account dropdown it reads as a plain menu row naming the mode the
  // click switches TO; in the nav band it stays the compact ☀/☾ icon button.
  if (inMenu) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={theme === 'dark'}
        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-black hover:bg-neutral-100"
      >
        <span aria-hidden="true" className="w-4 text-center">{theme === 'dark' ? '☀' : '☾'}</span>
        {theme === 'dark' ? 'Light mode' : 'Dark mode'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={theme === 'dark'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="inline-flex min-h-[2.5rem] min-w-[2.5rem] items-center justify-center rounded border border-band-ink/30 px-2 text-sm hover:border-gold-light hover:text-gold-light"
    >
      <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
      <span className="sr-only">{theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}</span>
    </button>
  );
}
