/**
 * src/app/api/documents/[id]/route.ts — one stored document for re-render (#12 slice 1).
 *
 * GET → { summary, payload } where `payload` is the full render input ({ doc, profile },
 * or the legacy bare document) the client feeds to makeInput → renderToBlob. Session-
 * guarded and USER-SCOPED: `getDocument` filters by userId, so a valid id from another
 * account returns 404 (no cross-user leak). A malformed (non-uuid) id is 404 too (an
 * unknown row), as is a row absent because the DB is unconfigured — the read never
 * 500s on a miss.
 *
 * DELETE → { ok: true } for the owner's row, 404 for a malformed/unknown/other-user id.
 * Same session guard and uuid validation as GET; the delete is user-scoped in the data
 * layer so it can never remove another account's document.
 */
import { requireSessionUser, UnauthorizedError, type SessionUser } from '@/auth/session';
import { getDocument, deleteDocument } from '@/db/activities';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  let user: NonNullable<SessionUser>;
  try {
    user = await requireSessionUser(req.headers);
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    throw err;
  }

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return Response.json({ error: 'Not found' }, { status: 404 });

  const doc = await getDocument(user.id, id);
  if (!doc) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(doc);
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  let user: NonNullable<SessionUser>;
  try {
    user = await requireSessionUser(req.headers);
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    throw err;
  }

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return Response.json({ error: 'Not found' }, { status: 404 });

  const removed = await deleteDocument(user.id, id);
  if (!removed) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ ok: true });
}
