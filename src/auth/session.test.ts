import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getSessionUser, getSessionUserId } from './session';

// Guarantee the creds-guarded "unconfigured" path regardless of ambient env, so the
// seam returns null without ever touching next/headers or the DB.
function clearAuthEnv() {
  delete process.env.DATABASE_URL;
  delete process.env.BETTER_AUTH_SECRET;
}

describe('auth/session seam (#9, guarded)', () => {
  beforeEach(clearAuthEnv);
  afterEach(clearAuthEnv);

  it('getSessionUserId resolves null when auth is unconfigured', async () => {
    expect(await getSessionUserId()).toBeNull();
  });

  it('getSessionUser resolves null (anonymous) when unconfigured', async () => {
    expect(await getSessionUser()).toBeNull();
  });

  it('still short-circuits to null when passed Headers but unconfigured', async () => {
    const headers = new Headers({ cookie: 'session_token=whatever' });
    expect(await getSessionUser(headers)).toBeNull();
    expect(await getSessionUserId(headers)).toBeNull();
  });
});
