import { afterEach, describe, expect, it } from 'vitest';
import { isEmailConfigured, sendAuthEmail, sendPasswordResetEmail, __resetEmailForTests } from './email';

describe('auth email guard (#9)', () => {
  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    __resetEmailForTests();
  });

  it('isEmailConfigured reflects RESEND_API_KEY and ignores placeholders', () => {
    delete process.env.RESEND_API_KEY;
    expect(isEmailConfigured()).toBe(false);
    process.env.RESEND_API_KEY = 're_REPLACE_ME';
    expect(isEmailConfigured()).toBe(false);
    process.env.RESEND_API_KEY = 're_real_key';
    expect(isEmailConfigured()).toBe(true);
  });

  it('sendAuthEmail is a safe no-op when unconfigured (never throws)', async () => {
    delete process.env.RESEND_API_KEY;
    await expect(sendAuthEmail({ to: 'a@b.co', subject: 'x', html: 'y' })).resolves.toBeUndefined();
  });

  it('sendPasswordResetEmail resolves without throwing when unconfigured', async () => {
    delete process.env.RESEND_API_KEY;
    await expect(
      sendPasswordResetEmail({ to: 'a@b.co', url: 'https://q.vercel.app/reset?token=t' }),
    ).resolves.toBeUndefined();
  });
});
