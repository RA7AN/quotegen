/**
 * src/auth/session.ts — auth seam for issue #9 (Better Auth).
 *
 * Server-only helper that UI/route code will use to scope queries by user. It is a
 * deliberate no-op stub today: it returns null (anonymous) so the plumbing exists and
 * is tested, and #9 only swaps the body for a real Better Auth session lookup — no
 * call-site churn. It lives under `src/auth` (the allowed server boundary) and is NOT
 * imported by the deterministic core, keeping AC-24 green.
 */
export type SessionUser = { id: string; email: string } | null;

/** Resolve the current user's id, or null when signed out / before auth lands (#9). */
export async function getSessionUserId(): Promise<string | null> {
  return null;
}

/** Resolve the current session user, or null when signed out / before auth lands (#9). */
export async function getSessionUser(): Promise<SessionUser> {
  return null;
}
