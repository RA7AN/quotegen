import { describe, expect, it } from 'vitest';
import {
  authErrorMessage,
  extractResetToken,
  MIN_PASSWORD_LENGTH,
  validateEmail,
  validateName,
  validatePassword,
} from './forms';

describe('auth/forms validators (#9)', () => {
  it('validateEmail accepts a normal address and flags blank/malformed', () => {
    expect(validateEmail('user@example.com')).toBeUndefined();
    expect(validateEmail('  user@example.com  ')).toBeUndefined();
    expect(validateEmail('')).toMatch(/required/i);
    expect(validateEmail('nope')).toMatch(/valid email/i);
    expect(validateEmail('a@b')).toMatch(/valid email/i);
  });

  it('validateName requires non-blank text', () => {
    expect(validateName('Ada')).toBeUndefined();
    expect(validateName('   ')).toMatch(/required/i);
  });

  it('validatePassword enforces the shared minimum length', () => {
    expect(validatePassword('a'.repeat(MIN_PASSWORD_LENGTH))).toBeUndefined();
    expect(validatePassword('short')).toMatch(/at least 8/i);
    expect(validatePassword('')).toMatch(/required/i);
  });

  it('extractResetToken unwraps array/blank/null shapes', () => {
    expect(extractResetToken('tok123')).toBe('tok123');
    expect(extractResetToken(['tok123', 'other'])).toBe('tok123');
    expect(extractResetToken('  ')).toBeUndefined();
    expect(extractResetToken(null)).toBeUndefined();
    expect(extractResetToken(undefined)).toBeUndefined();
  });

  it('authErrorMessage flattens common error shapes', () => {
    expect(authErrorMessage(undefined)).toBe('');
    expect(authErrorMessage('boom')).toBe('boom');
    expect(authErrorMessage({ message: 'Invalid credentials' })).toBe('Invalid credentials');
    expect(authErrorMessage({ status: 429 })).toMatch(/429/);
    expect(authErrorMessage({})).toMatch(/went wrong/i);
  });
});
