import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireSessionUser = vi.fn();
vi.mock('@/auth/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/auth/session')>();
  return { ...actual, requireSessionUser };
});

const deleteSignoffBlock = vi.fn();
vi.mock('@/db/signoff', () => ({ deleteSignoffBlock }));

const { DELETE } = await import('./route');
const { UnauthorizedError } = await import('@/auth/session');

const UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

beforeEach(() => {
  requireSessionUser.mockReset();
  deleteSignoffBlock.mockReset();
});

function req(): Request {
  return new Request('http://localhost/api/signoff-blocks/x', { method: 'DELETE' });
}

describe('DELETE /api/signoff-blocks/[id] (#11 slice 2)', () => {
  it('is force-dynamic', async () => {
    expect((await import('./route')).dynamic).toBe('force-dynamic');
  });

  it('returns 401 when signed out', async () => {
    requireSessionUser.mockRejectedValue(new UnauthorizedError());
    const res = await DELETE(req(), { params: Promise.resolve({ id: UUID }) });
    expect(res.status).toBe(401);
    expect(deleteSignoffBlock).not.toHaveBeenCalled();
  });

  it('returns 404 for a malformed (non-uuid) id without touching the data layer', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    const res = await DELETE(req(), { params: Promise.resolve({ id: 'nope' }) });
    expect(res.status).toBe(404);
    expect(deleteSignoffBlock).not.toHaveBeenCalled();
  });

  it('deletes the owner-scoped row and returns ok', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    deleteSignoffBlock.mockResolvedValue(true);
    const res = await DELETE(req(), { params: Promise.resolve({ id: UUID }) });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(deleteSignoffBlock).toHaveBeenCalledWith('u1', UUID);
  });

  it('maps a no-op delete (unknown / other-user / unconfigured) to 404', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    deleteSignoffBlock.mockResolvedValue(false);
    const res = await DELETE(req(), { params: Promise.resolve({ id: UUID }) });
    expect(res.status).toBe(404);
  });
});
