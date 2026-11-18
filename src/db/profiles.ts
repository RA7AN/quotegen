/**
 * src/db/profiles.ts — per-user company profile + brand marks (#38).
 *
 * Server-only data helpers (inside the AC-24 api/db/auth boundary) backing the
 * cross-device workspace: read the active profile, and upsert it. Creds-guarded like
 * src/db/clients.ts — when DATABASE_URL is absent/placeholder the read returns null and
 * the write is an accepted-noop, so preview envs and pre-cred deploys stay green and the
 * Settings/wizard fall back to the device-local profile unchanged.
 *
 * Single-active-profile UX for now: every read/write targets the user's `isDefault` row.
 * The table already holds `name` + `isDefault` so #31 part 1 can grow a multi-profile
 * library on top of this exact helper without a migration.
 */
import { and, desc, eq } from 'drizzle-orm';
import { getDb, isDbConfigured } from './client';
import { profiles } from './schema';
import { CompanyProfileSchema, type CompanyProfile } from '@/domain/types';

/** The active profile plus its two brand-mark overrides (null = bundled crop). */
export type StoredProfile = {
  profile: CompanyProfile;
  headerMark: string | null;
  footerMark: string | null;
  setupComplete: boolean;
  updatedAt: string;
};

function toIso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

/**
 * The user's active (isDefault) profile, or null when there is none / the DB is not
 * configured / the stored payload no longer validates (defensive EC-11 parity — a
 * corrupt row degrades to "no server profile" so the UI falls back to local/defaults).
 */
export async function getActiveProfile(userId: string): Promise<StoredProfile | null> {
  if (!isDbConfigured()) return null;
  try {
    const [row] = await getDb()
      .select()
      .from(profiles)
      .where(and(eq(profiles.userId, userId), eq(profiles.isDefault, true)))
      .orderBy(desc(profiles.updatedAt))
      .limit(1);
    if (!row) return null;
    const parsed = CompanyProfileSchema.safeParse(row.payload);
    if (!parsed.success) return null;
    return {
      profile: parsed.data,
      headerMark: row.headerMark ?? null,
      footerMark: row.footerMark ?? null,
      setupComplete: row.setupComplete ?? false,
      updatedAt: toIso(row.updatedAt),
    };
  } catch {
    return null;
  }
}

/**
 * The user's first-run-onboarding marker (#37), read by the (app) server layout to gate
 * entry to the document wizard. Degrades OPEN: an unconfigured DB or a query error returns
 * true so the app never locks up in preview / pre-migration envs. false only when the
 * account genuinely has an active profile with `setup_complete = false`, or no profile row
 * yet (a brand-new account that has not run setup).
 */
export async function isSetupComplete(userId: string): Promise<boolean> {
  if (!isDbConfigured()) return true;
  try {
    const [row] = await getDb()
      .select({ setupComplete: profiles.setupComplete })
      .from(profiles)
      .where(and(eq(profiles.userId, userId), eq(profiles.isDefault, true)))
      .orderBy(desc(profiles.updatedAt))
      .limit(1);
    return row?.setupComplete ?? false;
  } catch {
    return true;
  }
}

/**
 * Create or refresh the user's active profile. When a default row already exists it is
 * updated in place (marks overwritten, including to null for "no override"); otherwise a
 * new isDefault row is inserted. `setupComplete` (#37) is written only when provided, so a
 * Settings save never silently re-opens the onboarding gate. Best-effort: returns the row
 * id, or null on any failure or an unconfigured DB, and never throws into the save path.
 */
export async function upsertActiveProfile(args: {
  userId: string;
  profile: CompanyProfile;
  headerMark: string | null;
  footerMark: string | null;
  setupComplete?: boolean;
}): Promise<string | null> {
  if (!isDbConfigured()) return null;
  const { userId, profile, headerMark, footerMark, setupComplete } = args;
  try {
    const db = getDb();
    const [existing] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(and(eq(profiles.userId, userId), eq(profiles.isDefault, true)))
      .orderBy(desc(profiles.updatedAt))
      .limit(1);
    if (existing) {
      await db
        .update(profiles)
        .set({
          payload: profile,
          headerMark,
          footerMark,
          updatedAt: new Date(),
          ...(setupComplete !== undefined ? { setupComplete } : {}),
        })
        .where(eq(profiles.id, existing.id));
      return existing.id;
    }
    const [created] = await db
      .insert(profiles)
      .values({ userId, payload: profile, headerMark, footerMark, isDefault: true, ...(setupComplete !== undefined ? { setupComplete } : {}) })
      .returning({ id: profiles.id });
    return created?.id ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Multi-profile library (#31 part 1)
//
// All of the below operate on the SAME profiles table #38 introduced — it already
// carries `name` + `isDefault` and deliberately has no unique constraint on userId,
// so a per-user library needs NO migration. Exactly one row keeps isDefault=true (the
// account's default profile the wizard/Settings fall back to); "set active" clears the
// others first. Best-effort + creds-guarded like the helpers above: reads return []/null
// and writes return false/null rather than throwing into a route.
// ---------------------------------------------------------------------------

/** A library row header for the picker/manager list (no payload / marks). */
export type ProfileSummary = {
  id: string;
  name: string;
  isDefault: boolean;
  updatedAt: string;
};

/** A full library row: the active-profile shape plus its identity (id + label). */
export type ProfileRecord = StoredProfile & { id: string; name: string; isDefault: boolean };

function toRecord(row: {
  id: string;
  name: string;
  isDefault: boolean;
  payload: unknown;
  headerMark: string | null;
  footerMark: string | null;
  setupComplete: boolean | null;
  updatedAt: Date | string;
}): ProfileRecord | null {
  const parsed = CompanyProfileSchema.safeParse(row.payload);
  if (!parsed.success) return null; // EC-11 parity: a corrupt row degrades to "not found"
  return {
    id: row.id,
    name: row.name,
    isDefault: !!row.isDefault,
    profile: parsed.data,
    headerMark: row.headerMark ?? null,
    footerMark: row.footerMark ?? null,
    setupComplete: row.setupComplete ?? false,
    updatedAt: toIso(row.updatedAt),
  };
}

/** The user's saved profiles, default first then most-recently-updated. [] when none / unconfigured / error. */
export async function listProfiles(userId: string): Promise<ProfileSummary[]> {
  if (!isDbConfigured()) return [];
  try {
    const rows = await getDb()
      .select({ id: profiles.id, name: profiles.name, isDefault: profiles.isDefault, updatedAt: profiles.updatedAt })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .orderBy(desc(profiles.isDefault), desc(profiles.updatedAt));
    return rows.map((r) => ({ id: r.id, name: r.name, isDefault: !!r.isDefault, updatedAt: toIso(r.updatedAt) }));
  } catch {
    return [];
  }
}

/** One full library row by id (scoped to the user), or null (missing / foreign / corrupt / error). */
export async function getProfileById(userId: string, id: string): Promise<ProfileRecord | null> {
  if (!isDbConfigured()) return null;
  try {
    const [row] = await getDb()
      .select()
      .from(profiles)
      .where(and(eq(profiles.userId, userId), eq(profiles.id, id)))
      .limit(1);
    return row ? toRecord(row) : null;
  } catch {
    return null;
  }
}

/**
 * Add a new named profile to the library. The FIRST profile for a user is always made the
 * default; otherwise `makeDefault` (when true) demotes the current default first. Returns
 * the new row id, or null on failure / unconfigured.
 */
export async function createProfile(args: {
  userId: string;
  name: string;
  profile: CompanyProfile;
  headerMark: string | null;
  footerMark: string | null;
  makeDefault?: boolean;
  setupComplete?: boolean;
}): Promise<string | null> {
  if (!isDbConfigured()) return null;
  const { userId, name, profile, headerMark, footerMark, makeDefault, setupComplete } = args;
  try {
    const db = getDb();
    const [any] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.userId, userId)).limit(1);
    const asDefault = makeDefault ?? any === undefined; // first-ever profile becomes the default
    if (asDefault && any) {
      await db.update(profiles).set({ isDefault: false }).where(and(eq(profiles.userId, userId), eq(profiles.isDefault, true)));
    }
    const [created] = await db
      .insert(profiles)
      .values({
        userId,
        name,
        payload: profile,
        headerMark,
        footerMark,
        isDefault: asDefault,
        ...(setupComplete !== undefined ? { setupComplete } : {}),
      })
      .returning({ id: profiles.id });
    return created?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Patch an existing row (label and/or payload and/or marks and/or the onboarding marker).
 * Marks are overwritten ONLY when the key is present (so a rename leaves them untouched);
 * a present-but-null mark clears it back to the bundled crop. Returns whether a row matched.
 */
export async function updateProfile(
  userId: string,
  id: string,
  patch: {
    name?: string;
    profile?: CompanyProfile;
    headerMark?: string | null;
    footerMark?: string | null;
    setupComplete?: boolean;
  },
): Promise<boolean> {
  if (!isDbConfigured()) return false;
  try {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.profile !== undefined) set.payload = patch.profile;
    if (patch.setupComplete !== undefined) set.setupComplete = patch.setupComplete;
    if ('headerMark' in patch) set.headerMark = patch.headerMark ?? null;
    if ('footerMark' in patch) set.footerMark = patch.footerMark ?? null;
    const [updated] = await getDb()
      .update(profiles)
      .set(set)
      .where(and(eq(profiles.userId, userId), eq(profiles.id, id)))
      .returning({ id: profiles.id });
    return Boolean(updated);
  } catch {
    return false;
  }
}

/**
 * Make one row the account default: clear the current default, then set this one. Two
 * sequential statements (the Neon HTTP driver has no interactive transaction); a transient
 * window with zero/two defaults is harmless because getActiveProfile de-dupes via
 * ORDER BY updatedAt DESC LIMIT 1. Returns whether the target row matched.
 */
export async function setActiveProfile(userId: string, id: string): Promise<boolean> {
  if (!isDbConfigured()) return false;
  try {
    const db = getDb();
    await db.update(profiles).set({ isDefault: false }).where(and(eq(profiles.userId, userId), eq(profiles.isDefault, true)));
    const [promoted] = await db
      .update(profiles)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(and(eq(profiles.userId, userId), eq(profiles.id, id)))
      .returning({ id: profiles.id });
    return Boolean(promoted);
  } catch {
    return false;
  }
}

/**
 * Delete a row. If it was the default, promote the most-recently-updated survivor so the
 * account always has an active profile while any rows remain. Returns whether a row was removed.
 */
export async function deleteProfile(userId: string, id: string): Promise<boolean> {
  if (!isDbConfigured()) return false;
  try {
    const db = getDb();
    const [row] = await db
      .select({ isDefault: profiles.isDefault })
      .from(profiles)
      .where(and(eq(profiles.userId, userId), eq(profiles.id, id)))
      .limit(1);
    if (!row) return false;
    await db.delete(profiles).where(and(eq(profiles.userId, userId), eq(profiles.id, id)));
    if (row.isDefault) {
      const [next] = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .orderBy(desc(profiles.updatedAt))
        .limit(1);
      if (next) await db.update(profiles).set({ isDefault: true }).where(eq(profiles.id, next.id));
    }
    return true;
  } catch {
    return false;
  }
}
