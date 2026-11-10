/**
 * app/(app)/kpi-strip.tsx — dashboard KPI strip (#10 slice 3).
 *
 * A client component mounted on the signed-in home dashboard: on mount it reads
 * GET /api/events/summary (the browser sends the session cookie) and renders three
 * to-date tiles — quotations generated, proforma invoices generated, drafts saved.
 * Degradation mirrors the data layer: a signed-out / unconfigured-DB run gets a 401
 * or zeroed payload and the strip simply does not render, so the dashboard never
 * shows a broken/empty frame.
 */
'use client';

import { useEffect, useState } from 'react';
import type { Kpis } from '@/db/activities';

const TILES: ReadonlyArray<{ key: keyof Kpis; label: string }> = [
  { key: 'quotationsGenerated', label: 'Quotations generated' },
  { key: 'proformasGenerated', label: 'Proforma invoices generated' },
  { key: 'draftsSaved', label: 'Drafts saved' },
];

export function KpiStrip() {
  const [kpis, setKpis] = useState<Kpis | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/events/summary')
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { kpis?: Kpis } | null) => {
        if (alive && body?.kpis) setKpis(body.kpis);
      })
      .catch(() => {
        /* telemetry is best-effort: leave the strip hidden */
      });
    return () => {
      alive = false;
    };
  }, []);

  // Hidden until a signed-in session returns real counts (avoids a zeroed frame for
  // visitors who have no activity yet, matching the pre-DB landing design).
  if (!kpis || (kpis.quotationsGenerated === 0 && kpis.proformasGenerated === 0 && kpis.draftsSaved === 0)) {
    return null;
  }

  return (
    <section aria-label="Your activity to date" className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {TILES.map((tile) => (
        <div key={tile.key} className="rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm">
          <div className="text-2xl font-bold tabular-nums">{kpis[tile.key]}</div>
          <div className="mt-0.5 text-xs text-muted">{tile.label}</div>
        </div>
      ))}
    </section>
  );
}
