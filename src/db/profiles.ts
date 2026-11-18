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
