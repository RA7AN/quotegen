import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_COMPANY_PROFILE } from '@/domain/defaults';

// Session + data seams are mocked: these tests pin the HTTP contract of the profile
// handlers (force-dynamic / 401 / null-null / 400 body + mark validation / PUT upsert),
// not auth or drizzle. cleanAsset + CompanyProfileSchema stay REAL (pure guards we test).
const requireSessionUser = vi.fn();
vi.mock('@/auth/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/auth/session')>();
  return { ...actual, requireSessionUser };
});

const getActiveProfile = vi.fn();
const upsertActiveProfile = vi.fn();
vi.mock('@/db/profiles', () => ({ getActiveProfile, upsertActiveProfile }));

const { GET, PUT } = await import('./route');
const { UnauthorizedError } = await import('@/auth/session');

const profile = { ...DEFAULT_COMPANY_PROFILE, legalNameEn: 'ACME Trading Co.' };

beforeEach(() => {
  requireSessionUser.mockReset();
  getActiveProfile.mockReset();
  upsertActiveProfile.mockReset();
});

function req(url = 'http://localhost/api/profile', init?: RequestInit): Request {
  return new Request(url, init);
}
function put(body: unknown): Request {
  return req('http://localhost/api/profile', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('GET /api/profile (#38)', () => {
  it('is force-dynamic (user-scoped reads are never prerendered)', async () => {
    expect((await import('./route')).dynamic).toBe('force-dynamic');
  });

  it('returns 401 when signed out and never queries', async () => {
    requireSessionUser.mockRejectedValue(new UnauthorizedError());
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(getActiveProfile).not.toHaveBeenCalled();
  });

  it('returns null/null when there is no stored profile (client falls back to local)', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    getActiveProfile.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ profile: null, assets: null });
    expect(getActiveProfile).toHaveBeenCalledWith('u1');
  });

  it('returns the stored profile + mark overrides', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    getActiveProfile.mockResolvedValue({
      profile,
      headerMark: 'data:image/png;base64,AA==',
      footerMark: null,
      updatedAt: '2026-11-04T10:00:00.000Z',
    });
    const res = await GET(req());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      profile,
      assets: { headerMark: 'data:image/png;base64,AA==', footerMark: null },
    });
  });
});

describe('PUT /api/profile (#38)', () => {
  it('returns 401 when signed out and never writes', async () => {
    requireSessionUser.mockRejectedValue(new UnauthorizedError());
    const res = await PUT(put({ profile }));
    expect(res.status).toBe(401);
    expect(upsertActiveProfile).not.toHaveBeenCalled();
  });

  it('returns 400 on a non-JSON body', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    const res = await PUT(put('{nope'));
    expect(res.status).toBe(400);
    expect(upsertActiveProfile).not.toHaveBeenCalled();
  });

  it('returns 400 when the profile fails CompanyProfileSchema', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    const res = await PUT(put({ profile: { nope: true } }));
    expect(res.status).toBe(400);
    expect(upsertActiveProfile).not.toHaveBeenCalled();
  });

  it('returns 400 when a submitted mark is not an accepted image data URL', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    const res = await PUT(put({ profile, assets: { headerMark: 'https://evil/x.png' } }));
    expect(res.status).toBe(400);
    expect(upsertActiveProfile).not.toHaveBeenCalled();
  });

  it('upserts for the session user and returns { ok:true, id }', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    upsertActiveProfile.mockResolvedValue('p1');
    const res = await PUT(put({ profile, assets: { headerMark: 'data:image/png;base64,AA==', footerMark: null } }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, id: 'p1' });
    expect(upsertActiveProfile).toHaveBeenCalledWith({
      userId: 'u1',
      profile: expect.objectContaining({ legalNameEn: 'ACME Trading Co.' }),
      headerMark: 'data:image/png;base64,AA==',
      footerMark: null,
    });
  });

  it('answers { ok:false, id:null } when the upsert no-ops (DB unconfigured)', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    upsertActiveProfile.mockResolvedValue(null);
    const res = await PUT(put({ profile }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: false, id: null });
  });
});
