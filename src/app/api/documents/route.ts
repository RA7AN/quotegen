/**
 * src/app/api/documents/route.ts — the user's recent stored documents (#12 slice 1).
 *
 * GET → { items: DocumentSummary[] } (payload omitted; fetched per-open). Session-guarded
 * like the events endpoints (401 when signed out / auth unconfigured), user-scoped, and
 * an empty list (200) when the DB isn't configured — the same creds-guarded degradation
 * the rest of the data layer uses, so previews never error. `?limit=` caps the page.
 */
import { requireSessionUser, UnauthorizedError, type SessionUser } from '@/auth/session';
import { listDocuments, DOC_LIST_LIMIT } from '@/db/activities';

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
  const limit = raw !== null && isPositiveNumber(raw) ? Number(raw) : DOC_LIST_LIMIT;
  const items = await listDocuments(user.id, limit);
  return Response.json({ items });
}

function isPositiveNumber(v: string): boolean {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}
