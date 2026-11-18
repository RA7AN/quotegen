/**
 * src/app/api/profile/route.ts — per-user company profile + brand marks (#38).
 *
 * GET  → { profile: CompanyProfile | null, assets: { headerMark, footerMark } | null }
 *          for the signed-in user's active profile. null/null when none is stored yet,
 *          which the client reads as "fall back to the device-local profile / defaults".
 * PUT  { profile, assets? } → upsert the active profile. The body is validated through
 *          CompanyProfileSchema (never trust the client) and each brand mark through the
 *          shared #5 data-URL guard (cleanAsset); an over-cap / malformed image is 400.
 *
 * Session-guarded like the clients/documents endpoints (401 when signed out or auth is
 * unconfigured) and creds-guarded at the DB layer, so the Settings save path can never
 * 500 before creds land. Server code stays inside the AC-24 api boundary.
 */
import { CompanyProfileSchema, type CompanyProfile } from '@/domain/types';
import { cleanAsset } from '@/lib/storage';
import { requireSessionUser, UnauthorizedError, type SessionUser } from '@/auth/session';
import { getActiveProfile, upsertActiveProfile } from '@/db/profiles';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  let user: NonNullable<SessionUser>;
  try {
    user = await requireSessionUser(req.headers);
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    throw err;
  }

  const stored = await getActiveProfile(user.id);
  if (!stored) return Response.json({ profile: null, assets: null });
  return Response.json({
    profile: stored.profile,
    assets: { headerMark: stored.headerMark, footerMark: stored.footerMark },
  });
}

export async function PUT(req: Request): Promise<Response> {
  let user: NonNullable<SessionUser>;
  try {
    user = await requireSessionUser(req.headers);
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    throw err;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const envelope = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const parsed = CompanyProfileSchema.safeParse(envelope.profile);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid profile payload', issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  // Marks are optional; a submitted value must be an accepted image data URL (or null).
  const assets = (envelope.assets && typeof envelope.assets === 'object' ? envelope.assets : {}) as Record<string, unknown>;
  const headerMark = assets.headerMark === undefined || assets.headerMark === null ? null : cleanAsset(assets.headerMark);
  const footerMark = assets.footerMark === undefined || assets.footerMark === null ? null : cleanAsset(assets.footerMark);
  const invalidMark =
    (assets.headerMark != null && headerMark === null) || (assets.footerMark != null && footerMark === null);
  if (invalidMark) {
    return Response.json({ error: 'Invalid brand mark: expected an image data URL' }, { status: 400 });
  }

  const id = await upsertActiveProfile({
    userId: user.id,
    profile: parsed.data as CompanyProfile,
    headerMark,
    footerMark,
  });
  return Response.json({ ok: id !== null, id });
}
