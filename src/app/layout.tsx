/**
 * app/layout.tsx — root HTML shell (site-wide metadata + Tailwind).
 *
 * Deliberately has no chrome of its own: each route group supplies its own header.
 *  - (marketing)/layout.tsx → PublicHeader + SiteFooter for the landing page.
 *  - (auth)/layout.tsx      → PublicHeader + centered card for sign-in/up/etc.
 *  - (app)/layout.tsx       → session-guarded header + main container.
 *
 * Keeping the root bare means the marketing landing can prerender static (no session
 * read), while the authenticated app routes opt into per-request rendering only where
 * they actually need it.
 */

import type { Metadata } from 'next';
import './globals.css';

// Applies the saved (or system) theme before first paint so dark mode never
// flashes the light stylesheet. Key must stay in sync with KEYS.theme.
const THEME_SCRIPT =
  "try{var t=localStorage.getItem('quotegen:theme:v1');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}";

export const metadata: Metadata = {
  title: 'Quotegen — Quotations & Proforma Invoices',
  description:
    'Deterministic quote & proforma builder for Encompass Design and Build / Elaf Al Yamamah. Guided wizard, exact PDF output, reusable client & sign-off libraries.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-white text-black antialiased">{children}</body>
    </html>
  );
}
