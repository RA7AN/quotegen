import { describe, expect, it, vi } from 'vitest';
import { authClient } from './client';

describe('auth client (#9)', () => {
  it('exposes the email/password, reset and session methods the UI calls', () => {
    expect(typeof authClient.signIn.email).toBe('function');
    expect(typeof authClient.signUp.email).toBe('function');
    expect(typeof authClient.signOut).toBe('function');
    expect(typeof authClient.requestPasswordReset).toBe('function');
    expect(typeof authClient.resetPassword).toBe('function');
    expect(typeof authClient.getSession).toBe('function');
  });

  // The client proxy derives the request path from the method name (kebab-case), so a
  // stale forgetPassword() call silently POSTs /forget-password — which Better Auth 1.7
  // no longer registers server-side (404). Pin the ACTUAL path the reset request hits so
  // a future rename or a regression to the old method fails here, not in production (#53).
  it('POSTs requestPasswordReset to /api/auth/request-password-reset, never /forget-password', async () => {
    const requestedUrls: string[] = [];
    // The client binds global fetch at creation time (config.mjs customFetchImpl), so we
    // must stub BEFORE (re)constructing it: reset the registry, stub, then re-import so the
    // fresh client captures the mock.
    vi.resetModules();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        requestedUrls.push(typeof input === 'string' ? input : input.toString());
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );
    const { authClient: freshClient } = await import('./client');
    await freshClient
      .requestPasswordReset({ email: 'user@example.com', redirectTo: '/reset-password' })
      .catch(() => {}); // response shape is irrelevant; we assert the request path only

    expect(requestedUrls).toHaveLength(1);
    expect(requestedUrls[0]).toContain('/api/auth/request-password-reset');
    expect(requestedUrls[0]).not.toContain('/forget-password');

    vi.unstubAllGlobals();
  });
});
