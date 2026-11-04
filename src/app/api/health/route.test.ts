import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET } from './route';

// Proves the health route is build/CI-safe: with no real DATABASE_URL it reports
// "placeholder" and never attempts a DB connection (the guard issue #13 relies on).
let original: string | undefined;

beforeEach(() => {
  original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
});

afterEach(() => {
  if (original === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = original;
});

describe('GET /api/health', () => {
  it('returns ok + db "placeholder" when unconfigured', async () => {
    const res = await GET(new Request('http://localhost/api/health'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: 'placeholder' });
  });

  it('does not attempt a live ping while unconfigured, even with ?ping=1', async () => {
    const res = await GET(new Request('http://localhost/api/health?ping=1'));
    const body = await res.json();
    expect(body.db).toBe('placeholder');
    expect(body.ping).toBeUndefined();
  });
});
