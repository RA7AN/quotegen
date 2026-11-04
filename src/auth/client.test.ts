import { describe, expect, it } from 'vitest';
import { authClient } from './client';

describe('auth client (#9)', () => {
  it('exposes the email/password, reset and session methods the UI calls', () => {
    expect(typeof authClient.signIn.email).toBe('function');
    expect(typeof authClient.signUp.email).toBe('function');
    expect(typeof authClient.signOut).toBe('function');
    expect(typeof authClient.forgetPassword).toBe('function');
    expect(typeof authClient.resetPassword).toBe('function');
    expect(typeof authClient.getSession).toBe('function');
  });
});
