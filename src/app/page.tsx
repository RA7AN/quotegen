/**
 * app/page.tsx — landing → /new (Build-kit/02 §2, HP-1 step 1).
 */

import Link from 'next/link';
import { KpiStrip } from './kpi-strip';

export default function Page() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-2xl font-bold">Quotegen</h1>
      <p className="mt-2 max-w-prose text-sm text-muted">
        Produce a client-ready Quotation or Proforma Invoice PDF in minutes — guided
        wizard, deterministic calculations, zero manual formatting. Everything stays in
        this browser.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/new"
          className="rounded bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
        >
          Start a new quote →
        </Link>
        <Link href="/quotes" className="rounded border border-neutral-300 px-5 py-2.5 text-sm hover:bg-neutral-100">
          Saved quotes
        </Link>
        <Link href="/settings" className="rounded border border-neutral-300 px-5 py-2.5 text-sm hover:bg-neutral-100">
          Company settings
        </Link>
      </div>
      <KpiStrip />
    </main>
  );
}
