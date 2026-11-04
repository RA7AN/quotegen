/**
 * drizzle.config.ts — drizzle-kit config for migrations (issue #13).
 *
 * `drizzle-kit generate` runs offline (no DB needed) and writes SQL + the journal
 * into ./drizzle, which is committed for reproducible deploys. `drizzle-kit push` /
 * `migrate` need a real DATABASE_URL (Neon) — supplied via env when creds land.
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
