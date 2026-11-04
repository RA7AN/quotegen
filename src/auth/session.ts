/**
 * src/auth/session.ts — auth seam for the server (real since #9).
 *
 * Server-only helper that UI/route code uses to scope queries by user. It is
 * creds-guarded: when Better Auth isn't configured (no DATABASE_URL /
 * BETTER_AUTH_SECRET) it returns null (anonymous) instead of throwing, so the app,
 * build and unit tests keep working before auth creds land and in preview envs.
 * When configured, it resolves the Better Auth session — from an explicit Headers
 * (route handlers) or Next's request headers (server components), loaded lazily so
 * importing this module never pulls in `next/headers`.
 *
 * Lives under `src/auth` (the allowed server boundary, AC-24) and is never imported
 * by the deterministic core.
 */
import { getAuth, isAuthConfigured } from './config';

export type SessionUser = { id: string; email: string } | null;

/** Resolve the current session user, or null when signed out / unconfigured. */
export async function getSessionUser(headers?: Headers): Promise<SessionUser> {
  if (!isAuthConfigured()) return null;
  const requestHeaders = headers ?? (await (await import('next/headers')).headers());
  const session = await getAuth().api.getSession({ headers: requestHeaders as Headers });
  if (!session?.user) return null;
  return { id: session.user.id, email: session.user.email };
}

/** Resolve the current user's id, or null when signed out / unconfigured. */
export async function getSessionUserId(headers?: Headers): Promise<string | null> {
  return (await getSessionUser(headers))?.id ?? null;
}
