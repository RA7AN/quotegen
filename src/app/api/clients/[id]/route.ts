/**
 * src/app/api/clients/[id]/route.ts — delete one saved client profile (#11 slice 1).
 *
 * DELETE → { ok: true } for the owner's row; 404 for a malformed (non-uuid) or unknown
 * id, and for a valid id that belongs to another account (the data layer scopes by
 * userId, so it deletes nothing → false). Same session guard as the list/upsert route;
 * an unconfigured DB deletes nothing and answers 404 (never 500). Powers the "Manage"
 * list's remove action, which runs through the in-app ConfirmDialog (AC-9).
 */
import { requireSessionUser, UnauthorizedError, type SessionUser } from '@/auth/session';
import { deleteClient } from '@/db/clients';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  const removed = await deleteClient(user.id, id);
  if (!removed) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ ok: true });
}
