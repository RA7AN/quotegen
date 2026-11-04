import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getAuth, isAuthConfigured, __resetAuthForTests } from './config';
import { __resetDbForTests } from '@/db/client';

const DB = 'postgresql://user:pass@ep-x-pooler.neon.tech/neondb?sslmode=require';
const SECRET = 'a'.repeat(32);

function clearEnv() {
  delete process.env.DATABASE_URL;
  delete process.env.BETTER_AUTH_SECRET;
  __resetAuthForTests();
  __resetDbForTests();
}

describe('auth config guards (#9)', () => {
  beforeEach(clearEnv);
  afterEach(clearEnv);

  it('isAuthConfigured is false until BOTH the DB and secret are present', () => {
    expect(isAuthConfigured()).toBe(false);
    process.env.DATABASE_URL = DB;
    expect(isAuthConfigured()).toBe(false); // still missing the secret
    process.env.BETTER_AUTH_SECRET = SECRET;
    expect(isAuthConfigured()).toBe(true);
  });

  it('treats REPLACE_ME placeholders as unconfigured', () => {
    process.env.DATABASE_URL = 'postgresql://REPLACE_ME:REPLACE_ME@ep-REPLACE_ME-pooler.neon.tech/neondb';
    process.env.BETTER_AUTH_SECRET = 'REPLACE_ME_generate_with_npx_better-auth_generate-secret';
    expect(isAuthConfigured()).toBe(false);
  });

  it('getAuth reports the DATABASE_URL problem first when nothing is set', () => {
    expect(() => getAuth()).toThrowError(/DATABASE_URL is not configured/);
  });

  it('getAuth reports the secret problem when only the DB is set', () => {
    process.env.DATABASE_URL = DB;
    expect(() => getAuth()).toThrowError(/BETTER_AUTH_SECRET is not configured/);
  });

  it('getAuth constructs once configured, and memoizes the instance', () => {
    process.env.DATABASE_URL = DB;
    process.env.BETTER_AUTH_SECRET = SECRET;
    const a = getAuth();
    expect(a).toBeTruthy();
    expect(getAuth()).toBe(a); // second call returns the cached instance
  });
});
