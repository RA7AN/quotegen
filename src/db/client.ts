/**
 * src/db/client.ts — lazy Neon + Drizzle connection (issue #13).
 *
 * Deliberately lazy: importing this module must NEVER open a connection or throw,
 * so `next build` / static prerender / unit tests stay green whether or not
 * DATABASE_URL is configured. The connection is created on first `getDb()` call,
 * which only server route handlers (under `src/app/api/**`) should invoke.
 *
 * A single Neon HTTP connection (serverless driver) is used — the free Neon tier
 * + Vercel serverless model favours the pooler over a persistent socket.
 */
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const PLACEHOLDER_MARK = 'REPLACE_ME';

/** The literal we ship in `.env.example`; treated as "not configured". */
export function isPlaceholder(url: string | undefined): boolean {
  return !url || url.includes(PLACEHOLDER_MARK);
}

/** True only when DATABASE_URL is present and not the placeholder. */
export function isDbConfigured(): boolean {
  return !isPlaceholder(process.env.DATABASE_URL);
}

let cached: ReturnType<typeof drizzle> | undefined;

export function getDb() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  // Inline check (not isPlaceholder) so TS narrows `url` to string for neon().
  if (typeof url !== 'string' || url.includes(PLACEHOLDER_MARK)) {
    throw new Error(
      'DATABASE_URL is not configured — set a real Neon connection string before using the DB (issue #13).',
    );
  }
  const sql = neon(url);
  cached = drizzle(sql, { schema });
  return cached;
}

/** Test seam: drop the memoized client so tests can flip DATABASE_URL. */
export function __resetDbForTests(): void {
  cached = undefined;
}
