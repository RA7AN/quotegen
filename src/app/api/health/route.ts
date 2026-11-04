/**
 * src/app/api/health/route.ts — minimal server health check (issue #13).
 *
 * Proves the serverful runtime + data layer are wired, WITHOUT coupling build/CI to
 * a live database: the actual `select 1` ping only runs when `?ping=1` is passed AND
 * DATABASE_URL is really configured. In CI (no creds) it returns `db: "placeholder"`
 * and never opens a connection, so `next build` and the gate suite stay green.
 */
import { sql } from 'drizzle-orm';
import { getDb, isDbConfigured } from '@/db/client';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  const wantPing = new URL(req.url).searchParams.get('ping') === '1';
  const configured = isDbConfigured();
  const body: { ok: boolean; db: 'configured' | 'placeholder'; ping?: 'ok' | 'error' } = {
    ok: true,
    db: configured ? 'configured' : 'placeholder',
  };

  if (wantPing && configured) {
    try {
      await getDb().execute(sql`select 1`);
      body.ping = 'ok';
    } catch {
      body.ok = false;
      body.ping = 'error';
    }
  }

  return Response.json(body);
}
