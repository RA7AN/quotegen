/**
 * src/app/api/events/summary/route.ts — per-user KPI aggregates (#10 slice 1).
 *
 * GET → { counts, kpis } for the signed-in user: one grouped read over `events`
 * folded into the landing-strip tiles (quotations generated / proformas generated
 * / drafts saved). Session-guarded like POST /api/events; an unconfigured DB
 * returns zeroes (200) instead of failing, matching the creds-guarded degradation
 * of the rest of the data layer, so pre-cred previews render an empty strip.
 */
import { requireSessionUser, UnauthorizedError, type SessionUser } from '@/auth/session';
import { eventCounts, deriveKpis } from '@/db/activities';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  let user: NonNullable<SessionUser>;
  try {
    user = await requireSessionUser(req.headers);
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    throw err;
  }

  const counts = await eventCounts(user.id);
  return Response.json({ counts, kpis: deriveKpis(counts) });
}
