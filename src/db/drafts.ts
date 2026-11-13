/**
 * src/db/drafts.ts — server-backed multi-drafts (multi-drafts slice).
 *
 * Server-only data helpers (inside the AC-24 api/db/auth boundary) for named,
 * in-progress documents that never became a quote: an insert-or-update keyed by the
 * client-held draft id, owner-scoped list/get/delete. Mirrors src/db/clients.ts:
 * creds-guarded (an absent/placeholder DATABASE_URL degrades to no-op / empty
 * results instead of throwing) and best-effort on writes, so a failing save can
 * never break the wizard — the caller surfaces the outcome as a toast.
 *
 * Identity columns (name/kind/number/clientName/step) are derived HERE from the
 * already-validated doc, never trusted from the request body, so list rows can't
 * desync from the payload. `payload` is the draft codec envelope
 * `{ schemaVersion, doc }` (same shape the localStorage autosave uses, so the
 * restore path shares one hydration contract).
 */
import { and, desc, eq } from 'drizzle-orm';
import { getDb, isDbConfigured } from './client';
import { drafts } from './schema';
import type { QuoteDocument } from '@/domain/types';
import { STORAGE_SCHEMA_VERSION, normalizeRestoredStep, type WizardStep } from '@/lib/storage';

/** Default + hard cap for the list read, so one query stays cheap under free tiers. */
export const DRAFT_LIST_LIMIT = 50;
const DRAFT_LIST_MAX = 200;

/** List row: everything the picker needs except the full doc. */
export type StoredDraftSummary = {
  id: string;
  name: string;
  kind: string;
  number: string | null;
  clientName: string | null;
  step: WizardStep;
  updatedAt: string;
};

/** Open row: the summary plus the validated document to hydrate the wizard with. */
export type StoredDraft = StoredDraftSummary & { doc: QuoteDocument };

function toIso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function toStep(value: number): WizardStep {
  return value === 1 || value === 2 || value === 3 || value === 4 ? (value as WizardStep) : 2;
}

/**
 * Auto-title for a draft: '<docNo> — <clientName>' with trimmed parts; whichever
 * half is missing degrades to the other, and a doc with neither still gets a name.
 * Exported so tests (and the route) pin one derivation.
 */
export function draftTitle(doc: QuoteDocument): string {
  const docNo = doc.meta.docNo.trim();
  const client = doc.client.name.trim();
  if (docNo && client) return `${docNo} — ${client}`;
  return docNo || client || 'Untitled draft';
}

function summarize(row: typeof drafts.$inferSelect): StoredDraftSummary {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    number: row.number,
    clientName: row.clientName,
    step: toStep(row.step),
    updatedAt: toIso(row.updatedAt),
  };
}

/**
 * Insert a new draft, or refresh the owner's existing one when `id` is supplied
 * (re-save of a loaded draft). Returns the row id the caller should track as its
 * draft identity, or null on any failure / unconfigured DB. An update that matches
 * no row (deleted / foreign id) falls through to a fresh insert so a stale tab's
 * Save-draft still does the useful thing instead of erroring.
 */
export async function saveDraft(args: {
  userId: string;
  id?: string | null;
  step: WizardStep;
  doc: QuoteDocument;
}): Promise<string | null> {
  if (!isDbConfigured()) return null;
  const step = normalizeRestoredStep(args.step);
  const values = {
    userId: args.userId,
    name: draftTitle(args.doc),
    kind: args.doc.template,
    number: args.doc.meta.docNo.trim() || null,
    clientName: args.doc.client.name.trim() || null,
    step,
    payload: { schemaVersion: STORAGE_SCHEMA_VERSION, doc: args.doc },
    updatedAt: new Date(),
  };
  try {
    if (args.id) {
      const [updated] = await getDb()
        .update(drafts)
        .set(values)
        .where(and(eq(drafts.id, args.id), eq(drafts.userId, args.userId)))
        .returning({ id: drafts.id });
      if (updated) return updated.id;
    }
    const [inserted] = await getDb()
      .insert(drafts)
      .values({ ...values, createdAt: new Date() })
      .returning({ id: drafts.id });
    return inserted?.id ?? null;
  } catch {
    return null;
  }
}

/** The user's drafts, most-recently-updated first, summaries only (payload stays put). */
export async function listDrafts(userId: string, limit = DRAFT_LIST_LIMIT): Promise<StoredDraftSummary[]> {
  if (!isDbConfigured()) return [];
  const capped = Math.min(Math.max(1, Math.floor(limit)), DRAFT_LIST_MAX);
  const rows = await getDb()
    .select()
    .from(drafts)
    .where(eq(drafts.userId, userId))
    .orderBy(desc(drafts.updatedAt))
    .limit(capped);
  return rows.map(summarize);
}

/**
 * One draft with its full doc for the open-in-wizard path, or null when the id is
 * unknown/foreign (owner-scoped) or the payload no longer decodes (schema drift is
 * surfaced as "not found", never a crash — EC-11 discipline).
 */
export async function getDraft(userId: string, id: string): Promise<StoredDraft | null> {
  if (!isDbConfigured()) return null;
  try {
    const [row] = await getDb()
      .select()
      .from(drafts)
      .where(and(eq(drafts.id, id), eq(drafts.userId, userId)))
      .limit(1);
    if (!row) return null;
    const payload = row.payload as { doc?: unknown };
    return { ...summarize(row), doc: payload.doc as QuoteDocument };
  } catch {
    return null;
  }
}

/**
 * Delete one draft, scoped to its owner. Returns true only when a row was actually
 * removed (mirrors deleteClient: a foreign/unknown id → false → route 404).
 */
export async function deleteDraft(userId: string, id: string): Promise<boolean> {
  if (!isDbConfigured()) return false;
  try {
    const deleted = await getDb()
      .delete(drafts)
      .where(and(eq(drafts.id, id), eq(drafts.userId, userId)))
      .returning({ id: drafts.id });
    return deleted.length > 0;
  } catch {
    return false;
  }
}
