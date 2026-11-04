/**
 * app/layout.tsx — root layout + top nav (Build-kit/02 §2 route shell).
 * Server component: no localStorage access here; every store touch lives in client
 * components' effects.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Quotegen — Quotations & Proforma Invoices',
  description: 'Deterministic quote builder for Encompass Design and Build / Elaf Al Yamamah.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-black antialiased">
        <header className="border-b-4 border-gold bg-black px-4 py-3 text-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <Link href="/" className="text-sm font-bold uppercase tracking-widest">
              Quotegen
            </Link>
            <nav aria-label="Primary" className="flex gap-4 text-xs uppercase tracking-wide">
              <Link href="/new" className="hover:text-gold-light">New quote</Link>
              <Link href="/quotes" className="hover:text-gold-light">Quotes</Link>
              <Link href="/settings" className="hover:text-gold-light">Settings</Link>
              <Link href="/sign-in" className="hover:text-gold-light">Sign in</Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
