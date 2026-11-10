/**
 * src/app/api/signoff-blocks/[id]/route.ts — delete one saved sign-off block (#11 slice 2).
 *
 * DELETE → { ok: true } for the owner's row; 404 for a malformed (non-uuid) or unknown
 * id, and for a valid id belonging to another account (the data layer scopes by userId,
 * so it deletes nothing → false). Same session guard as the list/upsert route; an
 * unconfigured DB deletes nothing and answers 404 (never 500). Powers the picker's
 * remove action, which runs through the in-app ConfirmDialog (AC-9).
 */
import { requireSessionUser, UnauthorizedError, type SessionUser } from '@/auth/session';
import { deleteSignoffBlock } from '@/db/signoff';

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

  const removed = await deleteSignoffBlock(user.id, id);
  if (!removed) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ ok: true });
}
