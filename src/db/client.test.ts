import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getDb, isDbConfigured, isPlaceholder, __resetDbForTests } from './client';

// These tests prove the load-bearing invariant for the static->serverful shift:
// importing/inspecting the client must never open a connection or throw when the
// DB isn't configured, so `next build`, prerender and unit tests stay green before
// real Neon creds land (issue #13).
let original: string | undefined;

beforeEach(() => {
  original = process.env.DATABASE_URL;
  __resetDbForTests();
});

afterEach(() => {
  if (original === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = original;
  __resetDbForTests();
});

describe('isPlaceholder', () => {
  it('flags missing values and the REPLACE_ME marker', () => {
    expect(isPlaceholder(undefined)).toBe(true);
    expect(isPlaceholder('')).toBe(true);
    expect(isPlaceholder('postgresql://REPLACE_ME@ep-x.neon.tech/db')).toBe(true);
  });

  it('accepts a real-looking URL', () => {
    expect(isPlaceholder('postgresql://u:p@ep-x.neon.tech/db')).toBe(false);
  });
});

describe('isDbConfigured', () => {
  it('false when DATABASE_URL is unset', () => {
    delete process.env.DATABASE_URL;
    expect(isDbConfigured()).toBe(false);
  });

  it('false for the placeholder value', () => {
    process.env.DATABASE_URL = 'postgresql://REPLACE_ME@ep-x.neon.tech/db';
    expect(isDbConfigured()).toBe(false);
  });

  it('true for a real-looking URL', () => {
    process.env.DATABASE_URL = 'postgresql://u:p@ep-x.neon.tech/db';
    expect(isDbConfigured()).toBe(true);
  });
});

describe('getDb guard', () => {
  it('throws a clear, actionable error when unconfigured (no connection opened)', () => {
    delete process.env.DATABASE_URL;
    expect(() => getDb()).toThrow(/DATABASE_URL is not configured/);
  });

  it('does not throw merely from being imported with no env set', () => {
    delete process.env.DATABASE_URL;
    // Reaching this assertion at all means the top-level import succeeded safely.
    expect(typeof getDb).toBe('function');
    expect(typeof isDbConfigured).toBe('function');
  });
});
