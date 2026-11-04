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
import { and, eq, desc, count, inArray } from 'drizzle-orm';
import { getDb, isDbConfigured } from './client';
import { documents, events } from './schema';

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

/**
 * Persist (or refresh) a generated document for a signed-in user (#10 slice 3),
 * enabling the re-render-on-open flow of #12 from `payload`. Upsert is keyed on
 * (userId, kind, number) — the unique index added with the deferred FK migration —
 * so repeated exports of the same doc number refresh rather than duplicate the row.
 * A document without a number still gets stored (plain insert, fresh row each time),
 * since the number is the only available business key. Best-effort like logEvent:
 * returns the row id on success, null on any failure or unconfigured DB.
 */
export async function saveDocument(args: {
  userId: string;
  kind: DocKind;
  number?: string | null;
  clientName?: string | null;
  payload: unknown;
}): Promise<string | null> {
  if (!isDbConfigured()) return null;
  const number = args.number?.trim() || null;
  const row = {
    userId: args.userId,
    kind: args.kind,
    number,
    clientName: args.clientName ?? null,
    payload: args.payload,
  };
  try {
    if (number) {
      const [saved] = await getDb()
        .insert(documents)
        .values(row)
        .onConflictDoUpdate({
          target: [documents.userId, documents.kind, documents.number],
          set: { payload: args.payload, clientName: args.clientName ?? null, updatedAt: new Date() },
        })
        .returning({ id: documents.id });
      return saved?.id ?? null;
    }
    const [saved] = await getDb().insert(documents).values(row).returning({ id: documents.id });
    return saved?.id ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Document reads (#12 — recent-documents list + single fetch for re-render)
// ---------------------------------------------------------------------------

/** Default + hard cap for the recent list, so one read stays cheap under free tiers. */
export const DOC_LIST_LIMIT = 50;
const DOC_LIST_MAX = 200;

/** Lightweight row metadata for the list view (payload omitted — fetched per-open). */
export type DocumentSummary = {
  id: string;
  kind: string;
  number: string | null;
  clientName: string | null;
  createdAt: string;
};

/**
 * The user's most-recent stored documents, newest first, capped at `limit`. Returns
 * [] when unconfigured (creds-guarded degradation like the rest of this module). The
 * `payload` is intentionally excluded here; a single document is fetched whole via
 * `getDocument` when the user opens/re-renders it.
 */
export async function listDocuments(userId: string, limit = DOC_LIST_LIMIT): Promise<DocumentSummary[]> {
  if (!isDbConfigured()) return [];
  const capped = Math.min(Math.max(1, Math.floor(limit)), DOC_LIST_MAX);
  const rows = await getDb()
    .select({
      id: documents.id,
      kind: documents.kind,
      number: documents.number,
      clientName: documents.clientName,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .where(eq(documents.userId, userId))
    .orderBy(desc(documents.createdAt))
    .limit(capped);
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    number: r.number,
    clientName: r.clientName,
    createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)).toISOString(),
  }));
}

/**
 * One stored document for re-render: full `payload` plus the summary columns. Returns
 * null when the id is unknown OR belongs to another user (the where-clause scopes by
 * userId, so a valid id from a different account yields null — no cross-user leak).
 */
export async function getDocument(
  userId: string,
  id: string,
): Promise<{ summary: DocumentSummary; payload: unknown } | null> {
  if (!isDbConfigured()) return null;
  const [row] = await getDb()
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .limit(1);
  if (!row) return null;
  return {
    summary: {
      id: row.id,
      kind: row.kind,
      number: row.number,
      clientName: row.clientName,
      createdAt: (row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt)).toISOString(),
    },
    payload: row.payload,
  };
}

/**
 * Delete one stored document, scoped to its owner. Returns true only when a row was
 * actually removed (a valid id from another account deletes nothing → false, which the
 * route maps to 404 — no cross-user delete). Best-effort like the rest of this module:
 * false when unconfigured or on any failure.
 */
export async function deleteDocument(userId: string, id: string): Promise<boolean> {
  if (!isDbConfigured()) return false;
  try {
    const deleted = await getDb()
      .delete(documents)
      .where(and(eq(documents.id, id), eq(documents.userId, userId)))
      .returning({ id: documents.id });
    return deleted.length > 0;
  } catch {
    return false;
  }
}

/** Retention cap (#12): how many recent documents each user keeps before the rest are pruned. */
export const DOC_RETENTION = 50;

/**
 * Best-effort retention: keep a user's newest `keep` documents and delete anything older,
 * so storage stays bounded under free-tier caps. Called after a successful save, when the
 * total is at most `keep + 1`, so the read stays cheap (no unbounded scan). Returns the
 * number pruned; 0 when unconfigured or on any failure (never throws into the export flow).
 */
export async function pruneDocuments(userId: string, keep = DOC_RETENTION): Promise<number> {
  if (!isDbConfigured()) return 0;
  try {
    const rows = await getDb()
      .select({ id: documents.id })
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.createdAt));
    const stale = rows.slice(Math.max(1, Math.floor(keep))).map((r) => r.id);
    if (stale.length === 0) return 0;
    await getDb().delete(documents).where(inArray(documents.id, stale));
    return stale.length;
  } catch {
    return 0;
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
