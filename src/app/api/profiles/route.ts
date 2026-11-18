/**
 * src/app/api/profiles/route.ts — the user's company-profile LIBRARY (#31 part 1).
 *
 * Sits ALONGSIDE the singular /api/profile (#38), which stays the "active/default profile"
 * read+write used by onboarding + the wizard's default load. This endpoint manages the set:
 *
 * GET  → { items: ProfileSummary[] } — id / name / isDefault / updatedAt for each saved
 *          profile (no payload or marks; the picker/manager only needs labels), default first.
 * POST { name?, profile, assets?, makeDefault? } → add a new library row ("save as new").
 *          `profile` runs through CompanyProfileSchema and each mark through the shared
 *          #5 data-URL guard (cleanAsset), exactly like the PUT on /api/profile. The first
 *          profile for a user is auto-defaulted; `makeDefault: true` defaults a later one.
 *
 * Session-guarded (401 signed out / unconfigured) + creds-guarded at the DB layer: an
 * unconfigured DB returns an empty list / accepted-noop rather than 500. Server code stays
 * inside the AC-24 api boundary.
 */
import { requireSessionUser, UnauthorizedError, type SessionUser } from '@/auth/session';
import { listProfiles, createProfile, type ProfileSummary } from '@/db/profiles';
import { parseProfileBody } from './_body';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  let user: NonNullable<SessionUser>;
  try {
    user = await requireSessionUser(req.headers);
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    throw err;
  }
  const items: ProfileSummary[] = await listProfiles(user.id);
  return Response.json({ items });
}

export async function POST(req: Request): Promise<Response> {
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

  const parsedBody = parseProfileBody(envelope);
  if (!parsedBody.ok) return Response.json({ error: parsedBody.error }, { status: 400 });

  const name = typeof envelope.name === 'string' && envelope.name.trim() ? envelope.name.trim() : 'Company profile';
  const makeDefault = typeof envelope.makeDefault === 'boolean' ? envelope.makeDefault : undefined;
  const id = await createProfile({
    userId: user.id,
    name,
    profile: parsedBody.profile,
    headerMark: parsedBody.headerMark,
    footerMark: parsedBody.footerMark,
    ...(makeDefault !== undefined ? { makeDefault } : {}),
  });
  return Response.json({ ok: id !== null, id }, { status: 202 });
}
