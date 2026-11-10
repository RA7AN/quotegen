/**
 * src/db/clients.ts — reusable client profiles (#11 slice 1).
 *
 * Server-only data helpers (inside the AC-24 api/db/auth boundary) backing the
 * auto-save + suggestion picker: a dedupe upsert, a per-user read for the picker,
 * and an owner-scoped delete. Like src/db/activities.ts this is creds-guarded —
 * when DATABASE_URL is absent/placeholder every helper degrades to a no-op / empty
 * result instead of throwing, so unit tests, preview envs and pre-cred deploys stay
 * green — and best-effort: writes return the row id (or null) and never throw, so a
 * failing upsert can't break the wizard's Next navigation (the caller logs nothing).
 *
 * Dedupe key is (userId, name, custId) — the unique index from migration 0003 — so a
 * repeat client with the same name + cust id refreshes the existing row rather than
 * piling up duplicates. `data` holds the full Client object (address lines, city,
 * CR No.) so accepting a suggestion can autofill every Step-1 client field.
 */
import { and, desc, eq } from 'drizzle-orm';
import { getDb, isDbConfigured } from './client';
import { clients } from './schema';
import type { Client } from '@/domain/types';

/** Default + hard cap for the suggestion read, so one query stays cheap under free tiers. */
export const CLIENT_LIST_LIMIT = 50;
const CLIENT_LIST_MAX = 200;

/** A stored profile: the identity columns plus the full client payload for autofill. */
export type StoredClient = {
  id: string;
  name: string;
  custId: string;
  data: Client;
  updatedAt: string;
};

function toIso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

/**
 * Insert or refresh a client profile for a signed-in user. An empty name is rejected
 * (returns null) — a half-typed/half-abandoned client never becomes a "saved" profile.
 * name/custId are trimmed for the business key (blank custId normalizes to '' so it
 * still joins the unique index). Best-effort: returns the row id on success, null on
 * any failure or unconfigured DB, and never throws into the wizard.
 */
export async function upsertClient(args: { userId: string; client: Client }): Promise<string | null> {
  if (!isDbConfigured()) return null;
  const name = args.client.name.trim();
  if (!name) return null;
  const custId = (args.client.custId ?? '').trim();
  const row = { userId: args.userId, name, custId, data: args.client };
  try {
    const [saved] = await getDb()
      .insert(clients)
      .values(row)
      .onConflictDoUpdate({
        target: [clients.userId, clients.name, clients.custId],
        set: { data: args.client, updatedAt: new Date() },
      })
      .returning({ id: clients.id });
    return saved?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * The user's saved client profiles, most-recently-updated first (the freshest reuse
 * candidates float to the top of the picker), capped at `limit`. Returns [] when
 * unconfigured. Full `data` is included so the UI can autofill without a per-row fetch.
 */
export async function listClients(userId: string, limit = CLIENT_LIST_LIMIT): Promise<StoredClient[]> {
  if (!isDbConfigured()) return [];
  const capped = Math.min(Math.max(1, Math.floor(limit)), CLIENT_LIST_MAX);
  const rows = await getDb()
    .select()
    .from(clients)
    .where(eq(clients.userId, userId))
    .orderBy(desc(clients.updatedAt))
    .limit(capped);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    custId: r.custId,
    data: r.data as Client,
    updatedAt: toIso(r.updatedAt),
  }));
}

/**
 * Delete one client profile, scoped to its owner. Returns true only when a row was
 * actually removed (a valid id from another account deletes nothing → false, which the
 * route maps to 404 — no cross-user delete). Best-effort: false when unconfigured or on
 * any failure (a malformed/non-uuid id errors in Postgres and is caught here).
 */
export async function deleteClient(userId: string, id: string): Promise<boolean> {
  if (!isDbConfigured()) return false;
  try {
    const deleted = await getDb()
      .delete(clients)
      .where(and(eq(clients.id, id), eq(clients.userId, userId)))
      .returning({ id: clients.id });
    return deleted.length > 0;
  } catch {
    return false;
  }
}
