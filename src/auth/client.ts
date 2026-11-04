/**
 * src/auth/client.ts — Better Auth client (#9).
 *
 * Isomorphic, side-effect-free factory the UI (sign-in/up, forgot/reset) calls. It
 * talks to the same-origin /api/auth handler, so no server creds are involved; baseURL
 * falls back to the current origin in the browser and a dev default otherwise.
 *
 * better-auth serves the /forget-password endpoint on the client at runtime, but the
 * standalone (server-unlinked) client TYPE omits it — we re-attach its signature once
 * here so UI call sites stay typed instead of casting at every use.
 */
import { createAuthClient } from 'better-auth/client';

const client = createAuthClient({
  baseURL:
    typeof window !== 'undefined'
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
});

export type ForgetPasswordArgs = { email: string; redirectTo?: string };

export const authClient = client as typeof client & {
  forgetPassword: (args: ForgetPasswordArgs) => Promise<unknown>;
};

export const { signIn, signUp, signOut, forgetPassword, resetPassword, getSession } = authClient;
