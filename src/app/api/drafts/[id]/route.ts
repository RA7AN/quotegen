/**
 * src/app/api/drafts/[id]/route.ts — one draft, owner-scoped (multi-drafts slice).
 *
 * GET    → { draft: StoredDraft } (summary + full doc) for the open-in-wizard path
 *          (/new?draft=<id>). 404 for a malformed/unknown/foreign id — the wizard
 *          shows a "draft not found" notice instead of crashing (EC-11 discipline).
 * DELETE → { ok: true } for the owner's row; 404 otherwise, mirroring the clients
 *          remove route. The /drafts list runs it through the in-app ConfirmDialog
 *          (AC-9).
 *
 * Same session guard as the collection route; an unconfigured DB reads 404 (never 500).
 */
import { requireSessionUser, UnauthorizedError, type SessionUser } from '@/auth/session';
import { deleteDraft, getDraft } from '@/db/drafts';

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

  const draft = await getDraft(user.id, id);
  if (!draft) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ draft });
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

  const removed = await deleteDraft(user.id, id);
  if (!removed) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ ok: true });
}
