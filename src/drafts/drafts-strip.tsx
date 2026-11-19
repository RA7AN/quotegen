/**
 * drafts/drafts-strip.tsx — compact "resume a draft" launcher (multi-drafts slice).
 *
 * One small client component reused in two places: above the wizard on /new and on
 * the Home dashboard. Shows the user's freshest drafts as open-able cards and hides
 * itself entirely while loading, signed out, or draft-free (the library seam answers
 * [] for all three), so a fresh account sees a clean page. `hrefAll` adds a "View
 * all" hop to /drafts when the picker is capped below the real count.
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchDrafts, type StoredDraftSummary } from '@/wizard/library';

export function DraftsStrip({ max = 4, title = 'Your drafts', hrefAll, collapsible = false }: { max?: number; title?: string; hrefAll?: string; collapsible?: boolean }) {
  const [items, setItems] = useState<StoredDraftSummary[] | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchDrafts(max).then((list) => {
      if (alive) setItems(list);
    });
    return () => {
      alive = false;
    };
  }, [max]);

  if (!items || items.length === 0) return null;

  const list = (
    <ul className="flex flex-wrap gap-2">
      {items.map((d) => (
        <li key={d.id}>
          {/* #49: the kind/step detail lived only in a `title` tooltip, which a phone user
              can never reach — it is now visible text as well as an aria-label. */}
          <Link
            href={`/new?draft=${encodeURIComponent(d.id)}`}
            aria-label={`${d.name} — ${d.kind === 'proforma' ? 'Proforma' : 'Quotation'}, step ${d.step} of 4`}
            className="inline-flex min-h-[2.75rem] items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs hover:border-gold"
            title={`${d.kind === 'proforma' ? 'Proforma' : 'Quotation'} · step ${d.step} of 4`}
          >
            <span className="max-w-[12rem] truncate font-medium">{d.name}</span>
            <span className="text-muted">
              step {d.step}/4 · {d.updatedAt.slice(0, 10)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );

  // #50: above the wizard a full drafts grid pushed the first input down to y 656 of 844 (78 %
  // chrome before the first field). On /new the strip collapses to a single-line <summary> so
  // the wizard starts near the top; Home keeps the always-open grid (its own launcher).
  if (collapsible) {
    return (
      <details className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <summary className="cursor-pointer text-sm font-medium text-black">
          {title} <span className="text-muted">({items.length})</span>
        </summary>
        <div className="mt-3">{list}</div>
        {hrefAll && (
          <Link href={hrefAll} className="mt-3 inline-flex min-h-[2.75rem] items-center px-2 text-xs font-medium text-gold hover:underline">
            View all →
          </Link>
        )}
      </details>
    );
  }

  return (
    <section aria-label={title} className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
        {hrefAll && (
          <Link
            href={hrefAll}
            className="inline-flex min-h-[2.75rem] items-center px-2 text-xs font-medium text-gold hover:underline"
          >
            View all →
          </Link>
        )}
      </div>
      {list}
    </section>
  );
}
