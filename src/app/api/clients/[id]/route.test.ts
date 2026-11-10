import { beforeEach, describe, expect, it, vi } from 'vitest';

// Session + data seams are mocked: these tests pin the DELETE handler's HTTP contract
// (401 / uuid validation / owner-scoped 404 semantics), not auth or drizzle.
const requireSessionUser = vi.fn();
vi.mock('@/auth/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/auth/session')>();
  return { ...actual, requireSessionUser };
});

const deleteClient = vi.fn();
vi.mock('@/db/clients', () => ({ deleteClient }));

const { DELETE } = await import('./route');
const { UnauthorizedError } = await import('@/auth/session');

const UUID = '11111111-2222-3333-4444-555555555555';

beforeEach(() => {
  requireSessionUser.mockReset();
  deleteClient.mockReset();
});

function req(): Request {
  return new Request('http://localhost/api/clients/x', { method: 'DELETE' });
}

describe('DELETE /api/clients/[id] (#11 slice 1)', () => {
  it('is force-dynamic', async () => {
    expect((await import('./route')).dynamic).toBe('force-dynamic');
  });

  it('returns 401 when signed out', async () => {
    requireSessionUser.mockRejectedValue(new UnauthorizedError());
    const res = await DELETE(req(), { params: Promise.resolve({ id: UUID }) });
    expect(res.status).toBe(401);
    expect(deleteClient).not.toHaveBeenCalled();
  });

  it('returns 404 for a malformed (non-uuid) id without touching the data layer', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    const res = await DELETE(req(), { params: Promise.resolve({ id: 'not-a-uuid' }) });
    expect(res.status).toBe(404);
    expect(deleteClient).not.toHaveBeenCalled();
  });

  it('deletes the owner-scoped row and returns ok', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    deleteClient.mockResolvedValue(true);
    const res = await DELETE(req(), { params: Promise.resolve({ id: UUID }) });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(deleteClient).toHaveBeenCalledWith('u1', UUID);
  });

  it('maps a no-op delete (unknown / other-user / unconfigured) to 404', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    deleteClient.mockResolvedValue(false);
    const res = await DELETE(req(), { params: Promise.resolve({ id: UUID }) });
    expect(res.status).toBe(404);
  });
});
