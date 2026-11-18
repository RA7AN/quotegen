import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_COMPANY_PROFILE } from '@/domain/defaults';

// Session + data seams are mocked: these tests pin the HTTP contract of the single-row
// get / patch / promote / delete handlers (401 / malformed-id 404 / unknown 404 / field-edit
// then promotion ordering / blank-name + bad-payload 400), not auth or drizzle. The body
// parser stays REAL (CompanyProfileSchema + cleanAsset guard shared with create).
const requireSessionUser = vi.fn();
vi.mock('@/auth/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/auth/session')>();
  return { ...actual, requireSessionUser };
});

const getProfileById = vi.fn();
const updateProfile = vi.fn();
const setActiveProfile = vi.fn();
const deleteProfile = vi.fn();
vi.mock('@/db/profiles', () => ({ getProfileById, updateProfile, setActiveProfile, deleteProfile }));

const { GET, PATCH, DELETE } = await import('./route');
const { UnauthorizedError } = await import('@/auth/session');

const profile = { ...DEFAULT_COMPANY_PROFILE, legalNameEn: 'ACME Trading Co.' };
const ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  requireSessionUser.mockReset();
  getProfileById.mockReset();
  updateProfile.mockReset();
  setActiveProfile.mockReset();
  deleteProfile.mockReset();
});

function req(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}
function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}
function bodyReq(method: string, body: unknown, id = ID): [Request, { params: Promise<{ id: string }> }] {
  return [
    req(`http://localhost/api/profiles/${id}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    ctx(id),
  ];
}

describe('GET /api/profiles/[id] (#31 one row)', () => {
  it('returns 401 when signed out', async () => {
    requireSessionUser.mockRejectedValue(new UnauthorizedError());
    const res = await GET(req('http://localhost/api/profiles/x'), ctx(ID));
    expect(res.status).toBe(401);
    expect(getProfileById).not.toHaveBeenCalled();
  });

  it('returns 404 for a malformed id without querying', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    const res = await GET(req('http://localhost/api/profiles/not-a-uuid'), ctx('not-a-uuid'));
    expect(res.status).toBe(404);
    expect(getProfileById).not.toHaveBeenCalled();
  });

  it('returns 404 when the row is unknown / foreign', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    getProfileById.mockResolvedValue(null);
    const res = await GET(req(`http://localhost/api/profiles/${ID}`), ctx(ID));
    expect(res.status).toBe(404);
  });

  it('maps the full record into profile / assets / marker', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    getProfileById.mockResolvedValue({
      id: ID,
      name: 'Main Co',
      isDefault: true,
      profile,
      headerMark: 'data:image/png;base64,AA==',
      footerMark: null,
      setupComplete: true,
      updatedAt: '2026-11-04T10:00:00.000Z',
    });
    const res = await GET(req(`http://localhost/api/profiles/${ID}`), ctx(ID));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      id: ID,
      name: 'Main Co',
      isDefault: true,
      profile,
      assets: { headerMark: 'data:image/png;base64,AA==', footerMark: null },
      setupComplete: true,
    });
    expect(getProfileById).toHaveBeenCalledWith('u1', ID);
  });
});

describe('PATCH /api/profiles/[id] (#31 edit / promote)', () => {
  it('returns 401 when signed out', async () => {
    requireSessionUser.mockRejectedValue(new UnauthorizedError());
    const [req2, c] = bodyReq('PATCH', { name: 'Z' });
    expect((await PATCH(req2, c)).status).toBe(401);
  });

  it('returns 404 for a malformed id without touching the DB', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    const [req2, c] = bodyReq('PATCH', { name: 'Z' }, 'nope');
    const res = await PATCH(req2, c);
    expect(res.status).toBe(404);
    expect(updateProfile).not.toHaveBeenCalled();
    expect(setActiveProfile).not.toHaveBeenCalled();
  });

  it('returns 400 on a non-JSON body', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    const [req2, c] = bodyReq('PATCH', '{oops');
    expect((await PATCH(req2, c)).status).toBe(400);
  });

  it('applies a rename patch and returns ok', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    updateProfile.mockResolvedValue(true);
    const [req2, c] = bodyReq('PATCH', { name: 'Renamed' });
    const res = await PATCH(req2, c);
    expect(res.status).toBe(200);
    expect(updateProfile).toHaveBeenCalledWith('u1', ID, expect.objectContaining({ name: 'Renamed' }));
    expect(setActiveProfile).not.toHaveBeenCalled();
  });

  it('returns 400 for a blank rename', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    const [req2, c] = bodyReq('PATCH', { name: '   ' });
    expect((await PATCH(req2, c)).status).toBe(400);
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('validates a profile payload (400 on bad marks)', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    const [req2, c] = bodyReq('PATCH', { profile, assets: { footerMark: 'http://x/y.png' } });
    expect((await PATCH(req2, c)).status).toBe(400);
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('forwards profile + marks into the patch on a payload edit', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    updateProfile.mockResolvedValue(true);
    const [req2, c] = bodyReq('PATCH', { profile, assets: { headerMark: 'data:image/png;base64,AA==' } });
    const res = await PATCH(req2, c);
    expect(res.status).toBe(200);
    const patch = updateProfile.mock.calls[0]![2] as Record<string, unknown>;
    expect(patch.headerMark).toBe('data:image/png;base64,AA==');
    expect(patch.footerMark).toBeNull(); // absent mark normalises to null (clears the override)
  });

  it('promotes after field edits when makeDefault is set (both run)', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    updateProfile.mockResolvedValue(false);
    setActiveProfile.mockResolvedValue(true);
    const [req2, c] = bodyReq('PATCH', { name: 'X', makeDefault: true });
    const res = await PATCH(req2, c);
    expect(res.status).toBe(200);
    expect(updateProfile).toHaveBeenCalled();
    expect(setActiveProfile).toHaveBeenCalledWith('u1', ID);
  });

  it('returns 404 when nothing was touched', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    updateProfile.mockResolvedValue(false);
    const [req2, c] = bodyReq('PATCH', { name: 'X' });
    expect((await PATCH(req2, c)).status).toBe(404);
  });
});

describe('DELETE /api/profiles/[id] (#31 remove)', () => {
  it('returns 401 when signed out', async () => {
    requireSessionUser.mockRejectedValue(new UnauthorizedError());
    const [req2, c] = bodyReq('DELETE', {});
    expect((await DELETE(req2, c)).status).toBe(401);
  });

  it('returns 404 for a malformed id', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    const [req2, c] = bodyReq('DELETE', {}, 'nope');
    expect((await DELETE(req2, c)).status).toBe(404);
    expect(deleteProfile).not.toHaveBeenCalled();
  });

  it('returns 404 when nothing was removed', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    deleteProfile.mockResolvedValue(false);
    const [req2, c] = bodyReq('DELETE', {});
    expect((await DELETE(req2, c)).status).toBe(404);
  });

  it('returns ok when a row was removed', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    deleteProfile.mockResolvedValue(true);
    const [req2, c] = bodyReq('DELETE', {});
    const res = await DELETE(req2, c);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(deleteProfile).toHaveBeenCalledWith('u1', ID);
  });
});
