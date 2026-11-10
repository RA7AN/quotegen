/**
 * drizzle.config.ts — drizzle-kit config for migrations (issue #13).
 *
 * `drizzle-kit generate` runs offline (no DB needed) and writes SQL + the journal
 * into ./drizzle, which is committed for reproducible deploys. `drizzle-kit push` /
 * `migrate` need a real DATABASE_URL (Neon) — supplied via env when creds land.
 *
 * Driver selection (issue #21): we intentionally do NOT set a top-level `driver`
 * field. Drizzle-kit's config schema only accepts cloud-specific driver strings
 * (d1-http / pglite / expo / aws-data-api / durable-sqlite); plain PG drivers
 * are picked by an installed-package priority: pg > postgres > @vercel/postgres
 * > @neondatabase/serverless (see node_modules/drizzle-kit/bin.cjs ~L78870).
 * Before #21 the only one installed was `@neondatabase/serverless`, so CI's
 * localhost service container was reached through a Neon websocket client that
 * explicitly refuses non-Neon hosts. We added `postgres` (postgres.js) as a
 * devDependency: drizzle-kit now picks it (higher priority than Neon) and
 * speaks the standard PG wire protocol, which works against BOTH the CI
 * container AND the Neon pooled endpoint (`-pooler`) in `.env.local`.
 * Runtime `src/db/client.ts` is unaffected: it imports `drizzle-orm/neon-http`
 * directly and never reads this config file.
 */
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Placeholder-safe: generate ignores this; migrate/push read the real env value.
    url: process.env.DATABASE_URL ?? 'postgresql://REPLACE_ME@ep-placeholder.neon.tech/neondb?sslmode=require',
  },
});
