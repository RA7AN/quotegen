/**
 * src/app/api/signoff-blocks/route.ts — reusable sign-off blocks (#11 slice 2).
 *
 * GET  → { items: StoredSignoffBlock[] } for the signed-in user (the Step-3 picker;
 *        full `data` included so accepting autofills every closing field). `?limit=` caps.
 * POST { ...Closing } → upsert one block, content-deduped. Body validated through
 *        ClosingSchema (AC-12) and stored as-is; the content key + label are derived
 *        SERVER-side in the data layer so a caller can't desync them from the payload.
 *
 * Session-guarded like the clients/events endpoints (401 when signed out or auth is
 * unconfigured) and creds-guarded: an unconfigured DB returns an empty list (200) / an
 * accepted-noop (202), so the wizard's Step-3 auto-save can never break navigation.
 */
import { ClosingSchema } from '@/domain/types';
import { requireSessionUser, UnauthorizedError, type SessionUser } from '@/auth/session';
import { listSignoffBlocks, upsertSignoffBlock, SIGNOFF_LIST_LIMIT } from '@/db/signoff';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  let user: NonNullable<SessionUser>;
  try {
    user = await requireSessionUser(req.headers);
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    throw err;
  }

  const raw = new URL(req.url).searchParams.get('limit');
  const limit = raw !== null && isPositiveNumber(raw) ? Number(raw) : SIGNOFF_LIST_LIMIT;
  const items = await listSignoffBlocks(user.id, limit);
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
  const parsed = ClosingSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid sign-off payload', issues: parsed.error.issues.map((i) => i.message) }, { status: 400 });
  }

  const id = await upsertSignoffBlock({ userId: user.id, block: parsed.data });
  return Response.json({ ok: id !== null, id }, { status: 202 });
}

function isPositiveNumber(v: string): boolean {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}
