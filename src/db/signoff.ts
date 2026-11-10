/**
 * src/db/signoff.ts — reusable sign-off blocks (#11 slice 2).
 *
 * Server-only data helpers (inside the AC-24 api/db/auth boundary) backing the Step-3
 * sign-off picker: a content-deduped upsert, a per-user read, and an owner-scoped
 * delete. Creds-guarded and best-effort exactly like src/db/clients.ts — every helper
 * no-ops (null / [] / false) when DATABASE_URL is absent, and never throws into the
 * wizard's navigation.
 *
 * Dedupe key is a deterministic `contentKey` derived from the normalized closing fields
 * (the unique index from migration 0004): re-saving an unchanged block on each Step-3
 * navigation just refreshes its row, while a genuinely different signer becomes a new
 * saved block. A blank block (no signer name AND no email) is never stored.
 */
import { and, desc, eq } from 'drizzle-orm';
import { getDb, isDbConfigured } from './client';
import { signoffBlocks } from './schema';
import type { Closing } from '@/domain/types';

/** Default + hard cap for the picker read, so one query stays cheap under free tiers. */
export const SIGNOFF_LIST_LIMIT = 50;
const SIGNOFF_LIST_MAX = 200;

/** Field order the content key folds, so two orderings of the same values dedupe alike. */
const KEY_FIELDS = ['signoff', 'name', 'org', 'mobile', 'email', 'website'] as const;

export type StoredSignoffBlock = {
  id: string;
  label: string | null;
  data: Closing;
  updatedAt: string;
};

function toIso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

/** Deterministic content key: trimmed fields joined by a control char (no clock/random). */
export function signoffContentKey(block: Closing): string {
  return KEY_FIELDS.map((f) => (block[f] ?? '').trim()).join('\u0001');
}

/**
 * Insert or refresh a sign-off block for a signed-in user. Rejected (returns null) when
 * the block has neither a signer name nor an email — a default/empty closing is not a
 * reusable identity. label defaults to the signer's name for the picker. Best-effort:
 * returns the row id on success, null on any failure or unconfigured DB, never throws.
 */
export async function upsertSignoffBlock(args: { userId: string; block: Closing }): Promise<string | null> {
  if (!isDbConfigured()) return null;
  const name = (args.block.name ?? '').trim();
  const email = (args.block.email ?? '').trim();
  if (!name && !email) return null;
  const contentKey = signoffContentKey(args.block);
  const row = { userId: args.userId, label: name || null, contentKey, data: args.block };
  try {
    const [saved] = await getDb()
      .insert(signoffBlocks)
      .values(row)
      .onConflictDoUpdate({
        target: [signoffBlocks.userId, signoffBlocks.contentKey],
        set: { data: args.block, label: name || null, updatedAt: new Date() },
      })
      .returning({ id: signoffBlocks.id });
    return saved?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * The user's saved sign-off blocks, most-recently-updated first, capped at `limit`.
 * Returns [] when unconfigured. Full `data` is included so accepting autofills every
 * Step-3 closing field without a per-row fetch.
 */
export async function listSignoffBlocks(userId: string, limit = SIGNOFF_LIST_LIMIT): Promise<StoredSignoffBlock[]> {
  if (!isDbConfigured()) return [];
  const capped = Math.min(Math.max(1, Math.floor(limit)), SIGNOFF_LIST_MAX);
  const rows = await getDb()
    .select()
    .from(signoffBlocks)
    .where(eq(signoffBlocks.userId, userId))
    .orderBy(desc(signoffBlocks.updatedAt))
    .limit(capped);
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    data: r.data as Closing,
    updatedAt: toIso(r.updatedAt),
  }));
}

/**
 * Delete one sign-off block, scoped to its owner. Returns true only when a row was
 * actually removed (another account's id deletes nothing → false, mapped to 404 by the
 * route). Best-effort: false when unconfigured or on any failure (non-uuid ids error in
 * Postgres and are caught here).
 */
export async function deleteSignoffBlock(userId: string, id: string): Promise<boolean> {
  if (!isDbConfigured()) return false;
  try {
    const deleted = await getDb()
      .delete(signoffBlocks)
      .where(and(eq(signoffBlocks.id, id), eq(signoffBlocks.userId, userId)))
      .returning({ id: signoffBlocks.id });
    return deleted.length > 0;
  } catch {
    return false;
  }
}
