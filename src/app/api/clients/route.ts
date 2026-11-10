/**
 * src/app/api/clients/route.ts — reusable client profiles (#11 slice 1).
 *
 * GET    → { items: StoredClient[] } for the signed-in user (the Step-1 suggestion
 *          picker; full `data` included so accepting autofills every field). `?limit=`
 *          caps the page.
 * POST   { ...Client } → upsert one profile, deduped on (userId, name, custId). The
 *          body is validated through ClientSchema (AC-12: never trust the client), and
 *          the identity columns are derived SERVER-side from the validated object so a
 *          caller can't desync name/custId from the stored data.
 *
 * Session-guarded like the events/documents endpoints (401 when signed out or auth is
 * unconfigured) and creds-guarded: an unconfigured DB returns an empty list (200) / an
 * accepted-noop (202) rather than 500, so the wizard's Next auto-save can never break.
 */
import { ClientSchema } from '@/domain/types';
import { requireSessionUser, UnauthorizedError, type SessionUser } from '@/auth/session';
import { listClients, upsertClient, CLIENT_LIST_LIMIT } from '@/db/clients';

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
  const limit = raw !== null && isPositiveNumber(raw) ? Number(raw) : CLIENT_LIST_LIMIT;
  const items = await listClients(user.id, limit);
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
  const parsed = ClientSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid client payload', issues: parsed.error.issues.map((i) => i.message) }, { status: 400 });
  }

  const id = await upsertClient({ userId: user.id, client: parsed.data });
  return Response.json({ ok: id !== null, id }, { status: 202 });
}

function isPositiveNumber(v: string): boolean {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}
