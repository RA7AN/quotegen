import { describe, expect, it } from 'vitest';
import { getSessionUser, getSessionUserId } from './session';

describe('auth/session stub (#13 groundwork → #9)', () => {
  it('getSessionUserId resolves null (no session provider yet)', async () => {
    expect(await getSessionUserId()).toBeNull();
  });

  it('getSessionUser resolves null (anonymous)', async () => {
    expect(await getSessionUser()).toBeNull();
  });
});
