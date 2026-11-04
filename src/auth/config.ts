/**
 * src/auth/config.ts — Better Auth server instance (#9).
 *
 * Lazy + guarded: importing this module NEVER constructs Better Auth, so
 * `next build` / CI stay green without DATABASE_URL or BETTER_AUTH_SECRET. The
 * instance is created on the first getAuth() call, which only the api/auth route
 * handler makes at request time. Password reset is built into `emailAndPassword`;
 * the reset email is delegated to our creds-guarded Resend sender (./email).
 *
 * Lives under `src/auth` (the allowed server boundary per AC-24) and is never
 * imported by the deterministic core (src/lib|domain|pdf).
 */
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getDb, isDbConfigured } from '@/db/client';
import { account, session, user, verification } from '@/db/schema';
import { sendPasswordResetEmail } from './email';

const PLACEHOLDER_MARK = 'REPLACE_ME';

function isSecretSet(): boolean {
  const secret = process.env.BETTER_AUTH_SECRET;
  return !!secret && !secret.includes(PLACEHOLDER_MARK);
}

/** True only when both the DB and the auth secret are configured. */
export function isAuthConfigured(): boolean {
  return isDbConfigured() && isSecretSet();
}

let cached: ReturnType<typeof betterAuth> | undefined;

/** Build (once) and return the Better Auth server instance. Throws if unconfigured. */
export function getAuth() {
  if (cached) return cached;
  if (!isDbConfigured()) {
    throw new Error('DATABASE_URL is not configured — auth cannot initialize (issue #9).');
  }
  if (!isSecretSet()) {
    throw new Error('BETTER_AUTH_SECRET is not configured — auth cannot initialize (issue #9).');
  }
  const options: BetterAuthOptions = {
    appName: 'Quotegen',
    baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), {
      provider: 'pg',
      // Better Auth resolves models by these exact singular keys.
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // MVP: sign-in works before SMTP/DKIM lands
      autoSignIn: true,
      resetPasswordTokenExpiresIn: 60 * 60, // 1 hour
      sendResetPassword: async ({ user: u, url }) => {
        await sendPasswordResetEmail({ to: u.email, url });
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 7 }, // 7 days
  };
  cached = betterAuth(options);
  return cached;
}

/** Test seam: drop the memoized instance so tests can flip env vars. */
export function __resetAuthForTests(): void {
  cached = undefined;
}
