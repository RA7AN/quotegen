/**
 * src/db/activities.ts — activity logging + KPI aggregates (#10 slice 1).
 *
 * Server-only data helpers (inside the AC-24 api/db/auth boundary) backing the
 * landing KPI strip: an append-only write to `events` per user action, and one
 * grouped read that powers the strip. Like src/auth/session.ts and src/db/client.ts
 * this is creds-guarded: when DATABASE_URL is absent/placeholder every helper
 * degrades to a no-op / empty result instead of throwing, so unit tests, preview
 * envs and pre-cred deploys stay green.
 *
 * Event vocabulary (loader for the UI; the strip maps these to KPI tiles):
 *  - 'exported'       — a PDF Download/Print succeeded (docKind = template kind)
 *  - 'draft_saved'    — wizard autosave persisted a draft
 *  - 'snapshot_saved' — explicit "Save quote" snapshot (localStorage, device-local)
 *  - 'document_saved' — document row written to `documents` (payload, #12 reuse)
 */
import { eq, count } from 'drizzle-orm';
import { getDb, isDbConfigured } from './client';
import { events } from './schema';

export const EVENT_KINDS = ['exported', 'draft_saved', 'snapshot_saved', 'document_saved'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** Template vocab shared with QuoteDocument.template ('quotation' | 'proforma'). */
export const DOC_KINDS = ['quotation', 'proforma'] as const;
export type DocKind = (typeof DOC_KINDS)[number];

/** The `events.documentId` column is a uuid — anything else is dropped, not stored. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LogEventArgs = {
  userId: string;
  kind: EventKind;
  docKind?: DocKind | null;
  documentId?: string | null;
};

/**
 * Append one activity row. Best-effort by contract: unconfigured DB and insert
 * failures return false (callers never surface logging errors to the user), while
 * success returns true. Not async-throwing on purpose — route handlers decide the
 * HTTP status after checking the return value.
 */
export async function logEvent(args: LogEventArgs): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const documentId = typeof args.documentId === 'string' && UUID_RE.test(args.documentId) ? args.documentId : null;
  try {
    await getDb().insert(events).values({
      userId: args.userId,
      type: args.kind,
      docKind: args.docKind ?? null,
      documentId,
    });
    return true;
  } catch {
    return false;
  }
}

/** One grouped read over the user's events: counts by type and by (type, docKind). */
export type EventRow = { type: string; docKind: string | null; n: number };

export type EventCounts = {
  byType: Partial<Record<EventKind, number>>;
  exportsByDocKind: Partial<Record<DocKind, number>>;
  total: number;
};

/** Fold raw grouped rows into the shape the endpoints/KPI strip consume. Pure.
 * Unknown types never enter any field (foreign writers must not distort the KPIs). */
export function foldEventCounts(rows: EventRow[]): EventCounts {
  const byType: EventCounts['byType'] = {};
  const exportsByDocKind: EventCounts['exportsByDocKind'] = {};
  let total = 0;
  for (const row of rows) {
    const n = Number(row.n);
    if (!Number.isFinite(n) || n <= 0) continue;
    if (!(EVENT_KINDS as readonly string[]).includes(row.type)) continue;
    total += n;
    byType[row.type as EventKind] = (byType[row.type as EventKind] ?? 0) + n;
    if (row.type === 'exported' && row.docKind && (DOC_KINDS as readonly string[]).includes(row.docKind)) {
      exportsByDocKind[row.docKind as DocKind] = (exportsByDocKind[row.docKind as DocKind] ?? 0) + n;
    }
  }
  return { byType, exportsByDocKind, total };
}

/** Per-user event counts, or an empty fold when the DB is not configured. */
export async function eventCounts(userId: string): Promise<EventCounts> {
  if (!isDbConfigured()) return foldEventCounts([]);
  const rows = await getDb()
    .select({ type: events.type, docKind: events.docKind, n: count() })
    .from(events)
    .where(eq(events.userId, userId))
    .groupBy(events.type, events.docKind);
  return foldEventCounts(rows as EventRow[]);
}

/** The three landing-strip KPI tiles (#10): generated per template + drafts to date. */
export type Kpis = {
  quotationsGenerated: number;
  proformasGenerated: number;
  draftsSaved: number;
};

/** Map an event fold onto the KPI tiles. Pure so the mapping is unit-testable (AC-28-safe). */
export function deriveKpis(counts: EventCounts): Kpis {
  return {
    quotationsGenerated: counts.exportsByDocKind.quotation ?? 0,
    proformasGenerated: counts.exportsByDocKind.proforma ?? 0,
    draftsSaved: counts.byType.draft_saved ?? 0,
  };
}
