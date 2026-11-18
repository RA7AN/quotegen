import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_COMPANY_PROFILE } from '@/domain/defaults';

// Session + data seams are mocked: these tests pin the HTTP contract of the library list /
// create handlers (force-dynamic / 401 / shape / name defaulting / makeDefault forwarding /
// 400 body + mark validation), not auth or drizzle. parseProfileBody (→ CompanyProfileSchema
// + cleanAsset) stays REAL — it is the pure guard shared with the singular /api/profile PUT.
const requireSessionUser = vi.fn();
vi.mock('@/auth/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/auth/session')>();
  return { ...actual, requireSessionUser };
});

const listProfiles = vi.fn();
const createProfile = vi.fn();
vi.mock('@/db/profiles', () => ({ listProfiles, createProfile }));

const { GET, POST } = await import('./route');
const { UnauthorizedError } = await import('@/auth/session');

const profile = { ...DEFAULT_COMPANY_PROFILE, legalNameEn: 'ACME Trading Co.' };

beforeEach(() => {
  requireSessionUser.mockReset();
  listProfiles.mockReset();
  createProfile.mockReset();
});

function req(url = 'http://localhost/api/profiles', init?: RequestInit): Request {
  return new Request(url, init);
}
function post(body: unknown): Request {
  return req('http://localhost/api/profiles', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('GET /api/profiles (#31 list)', () => {
  it('is force-dynamic (user-scoped reads are never prerendered)', async () => {
    expect((await import('./route')).dynamic).toBe('force-dynamic');
  });

  it('returns 401 when signed out and never queries', async () => {
    requireSessionUser.mockRejectedValue(new UnauthorizedError());
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(listProfiles).not.toHaveBeenCalled();
  });

  it('returns the summary items for the session user', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    const items = [{ id: 'p1', name: 'Main Co', isDefault: true, updatedAt: '2026-11-04T10:00:00.000Z' }];
    listProfiles.mockResolvedValue(items);
    const res = await GET(req());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ items });
    expect(listProfiles).toHaveBeenCalledWith('u1');
  });
});

describe('POST /api/profiles (#31 create)', () => {
  it('returns 401 when signed out and never writes', async () => {
    requireSessionUser.mockRejectedValue(new UnauthorizedError());
    const res = await POST(post({ profile }));
    expect(res.status).toBe(401);
    expect(createProfile).not.toHaveBeenCalled();
  });

  it('returns 400 on a non-JSON body', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    const res = await POST(post('{nope'));
    expect(res.status).toBe(400);
    expect(createProfile).not.toHaveBeenCalled();
  });

  it('returns 400 when the profile fails CompanyProfileSchema', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    const res = await POST(post({ profile: { nope: true } }));
    expect(res.status).toBe(400);
    expect(createProfile).not.toHaveBeenCalled();
  });

  it('returns 400 when a submitted mark is not an accepted image data URL', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    const res = await POST(post({ profile, assets: { headerMark: 'https://evil/x.png' } }));
    expect(res.status).toBe(400);
    expect(createProfile).not.toHaveBeenCalled();
  });

  it('defaults a blank / absent name to "Company profile"', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    createProfile.mockResolvedValue('p1');
    await POST(post({ name: '   ', profile }));
    expect(createProfile).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', name: 'Company profile' }));
  });

  it('trims a provided name and forwards makeDefault only when a real boolean', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    createProfile.mockResolvedValue('p2');
    const res = await POST(post({ name: '  Branch X  ', profile, makeDefault: true }));
    expect(res.status).toBe(202);
    await expect(res.json()).resolves.toEqual({ ok: true, id: 'p2' });
    const arg = createProfile.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg.name).toBe('Branch X');
    expect(arg.makeDefault).toBe(true);

    createProfile.mockClear();
    createProfile.mockResolvedValue('p3');
    await POST(post({ profile })); // no makeDefault → key omitted (data layer auto-defaults first row)
    expect(createProfile.mock.calls[0]![0]).not.toHaveProperty('makeDefault');
  });

  it('answers { ok:false, id:null } when the create no-ops (DB unconfigured)', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    createProfile.mockResolvedValue(null);
    const res = await POST(post({ profile }));
    expect(res.status).toBe(202);
    await expect(res.json()).resolves.toEqual({ ok: false, id: null });
  });
});
