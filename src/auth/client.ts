/**
 * src/auth/client.ts — Better Auth client (#9).
 *
 * Isomorphic, side-effect-free factory the UI (sign-in/up, forgot/reset) calls. It
 * talks to the same-origin /api/auth handler, so no server creds are involved; baseURL
 * falls back to the current origin in the browser and a dev default otherwise.
 *
 * Better Auth 1.7 renamed the reset-request endpoint: method forgetPassword ->
 * requestPasswordReset, path /forget-password -> /request-password-reset. The client
 * proxy derives the request path from the method name, so the UI MUST call
 * requestPasswordReset — the old forgetPassword path is no longer registered
 * server-side and 404s (#53). The standalone (server-unlinked) client TYPE omits
 * requestPasswordReset, so we re-attach its signature once here for typed call sites.
 */
import { createAuthClient } from 'better-auth/client';

const client = createAuthClient({
  baseURL:
    typeof window !== 'undefined'
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
});

export type RequestPasswordResetArgs = { email: string; redirectTo?: string };

export const authClient = client as typeof client & {
  requestPasswordReset: (args: RequestPasswordResetArgs) => Promise<unknown>;
};

export const { signIn, signUp, signOut, requestPasswordReset, resetPassword, getSession } = authClient;
