/**
 * app/(app)/home/page.tsx — the signed-in dashboard (URL: `/home`).
 *
 * Replaces what used to live at `/` before the landing split: three primary CTAs (new
 * quote / saved quotes / company settings), a Recent shortcut, and the activity KPI
 * strip from #10. The `(app)` layout already redirects anonymous visitors to /sign-in,
 * so this page can assume a session and safely render user-scoped content.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { KpiStrip } from '../kpi-strip';

export const metadata: Metadata = { title: 'Home — Quotegen' };

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-bold">Home</h1>
      <p className="mt-2 max-w-prose text-sm text-muted">
        Produce a client-ready Quotation or Proforma Invoice PDF in minutes — guided wizard,
        deterministic calculations, zero manual formatting. Your saved clients and sign-off
        blocks come back on every new quote.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardCard
          href="/new"
          title="Start a new quote"
          body="Guided 4-step wizard, PDF preview, one-click download."
          emphasis
        />
        <DashboardCard href="/quotes" title="Saved quotes" body="Local snapshots you can open, duplicate, or delete." />
        <DashboardCard href="/recent" title="Recent documents" body="Re-render any past quote straight from its stored payload." />
        <DashboardCard href="/settings" title="Company settings" body="Legal identity, banking, tagline and signatory details." />
      </div>

      <KpiStrip />
    </main>
  );
}

function DashboardCard({
  href,
  title,
  body,
  emphasis,
}: {
  href: string;
  title: string;
  body: string;
  emphasis?: boolean;
}) {
  const cta = emphasis
    ? 'rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800'
    : 'rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100';
  return (
    <div className="flex flex-col justify-between rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{title}</h2>
        <p className="mt-1 text-xs text-muted">{body}</p>
      </div>
      <Link href={href} className={`${cta} mt-4 self-start`}>
        Open →
      </Link>
    </div>
  );
}
