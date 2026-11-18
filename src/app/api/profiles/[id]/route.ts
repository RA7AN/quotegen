/**
 * src/app/api/profiles/[id]/route.ts — edit / promote / delete ONE library profile (#31 part 1).
 *
 * PATCH  { name?, profile?, assets?, makeDefault?, setupComplete? } → patch the owner's row.
 *          `profile`/`assets` (when present) are validated exactly like create (CompanyProfileSchema
 *          + cleanAsset); `makeDefault: true` promotes the row to the account default (demoting the
 *          previous one in the data layer). Renames / set-default send a partial body.
 * DELETE → remove the row; deleting the default promotes the most-recent survivor.
 *
 * 404 for a malformed (non-uuid) or unknown / foreign id; 401 signed out; 400 on a bad
 * payload / mark. Creds-guarded so an unconfigured DB answers 404 rather than 500. Same
 * AC-24 api boundary + session guard as the list route.
 */
import { requireSessionUser, UnauthorizedError, type SessionUser } from '@/auth/session';
import { getProfileById, updateProfile, setActiveProfile, deleteProfile, type ProfileRecord } from '@/db/profiles';
import { parseProfileBody } from '../_body';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function authed(req: Request): Promise<NonNullable<SessionUser> | Response> {
  try {
    return await requireSessionUser(req.headers);
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    throw err;
  }
}

// GET pulls one FULL library row (payload + marks) — used by the per-quote picker and the
// Settings editor to load a specific saved profile into the form / render it.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = await authed(req);
  if (user instanceof Response) return user;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return Response.json({ error: 'Not found' }, { status: 404 });
  const record: ProfileRecord | null = await getProfileById(user.id, id);
  if (!record) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({
    id: record.id,
    name: record.name,
    isDefault: record.isDefault,
    profile: record.profile,
    assets: { headerMark: record.headerMark, footerMark: record.footerMark },
    setupComplete: record.setupComplete,
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = await authed(req);
  if (user instanceof Response) return user;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return Response.json({ error: 'Not found' }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const envelope = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const wantsProfile = envelope.profile !== undefined;
  const wantsRename = typeof envelope.name === 'string';
  const makeDefault = envelope.makeDefault === true;
  const setupComplete = typeof envelope.setupComplete === 'boolean' ? envelope.setupComplete : undefined;

  const patch: Parameters<typeof updateProfile>[2] = {};
  if (wantsRename) {
    const name = (envelope.name as string).trim();
    if (!name) return Response.json({ error: 'Profile name cannot be blank' }, { status: 400 });
    patch.name = name;
  }
  if (wantsProfile) {
    const parsedBody = parseProfileBody(envelope);
    if (!parsedBody.ok) return Response.json({ error: parsedBody.error }, { status: 400 });
    patch.profile = parsedBody.profile;
    patch.headerMark = parsedBody.headerMark;
    patch.footerMark = parsedBody.footerMark;
  }
  if (setupComplete !== undefined) patch.setupComplete = setupComplete;

  // Apply field edits first (if any), then promotion — so "save + make default" in one call works.
  let touched = false;
  if (Object.keys(patch).length > 0) touched = await updateProfile(user.id, id, patch);
  if (makeDefault) touched = (await setActiveProfile(user.id, id)) || touched;
  if (!touched) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = await authed(req);
  if (user instanceof Response) return user;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return Response.json({ error: 'Not found' }, { status: 404 });
  const removed = await deleteProfile(user.id, id);
  if (!removed) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ ok: true });
}
