import { beforeEach, describe, expect, it, vi } from 'vitest';

// Same mocked seams as the collection route test: pins GET-one / DELETE HTTP
// contract (401, uuid gate, 404 mapping), not auth or drizzle.
const requireSessionUser = vi.fn();
vi.mock('@/auth/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/auth/session')>();
  return { ...actual, requireSessionUser };
});

const getDraft = vi.fn();
const deleteDraft = vi.fn();
vi.mock('@/db/drafts', () => ({ getDraft, deleteDraft }));

const { GET, DELETE } = await import('./route');
const { UnauthorizedError } = await import('@/auth/session');

beforeEach(() => {
  requireSessionUser.mockReset();
  getDraft.mockReset();
  deleteDraft.mockReset();
});

const UUID = '00000000-0000-4000-8000-000000000001';

function req(method: 'GET' | 'DELETE', id: string): [Request, { params: Promise<{ id: string }> }] {
  return [new Request(`http://localhost/api/drafts/${id}`, { method }), { params: Promise.resolve({ id }) }];
}

describe('GET /api/drafts/[id] (multi-drafts slice)', () => {
  it('returns 401 when signed out and never queries', async () => {
    requireSessionUser.mockRejectedValue(new UnauthorizedError());
    const res = await GET(...req('GET', UUID));
    expect(res.status).toBe(401);
    expect(getDraft).not.toHaveBeenCalled();
  });

  it('404s a malformed id without touching the DB', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    const res = await GET(...req('GET', 'nope'));
    expect(res.status).toBe(404);
    expect(getDraft).not.toHaveBeenCalled();
  });

  it('404s unknown/foreign drafts (data layer returns null)', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    getDraft.mockResolvedValue(null);
    const res = await GET(...req('GET', UUID));
    expect(res.status).toBe(404);
    expect(getDraft).toHaveBeenCalledWith('u1', UUID);
  });

  it('returns the full draft for the owner', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    const draft = { id: UUID, name: 'X — Y', kind: 'quotation', step: 2, updatedAt: 'x', doc: {} };
    getDraft.mockResolvedValue(draft);
    const res = await GET(...req('GET', UUID));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ draft });
  });
});

describe('DELETE /api/drafts/[id] (multi-drafts slice)', () => {
  it('returns 401 when signed out', async () => {
    requireSessionUser.mockRejectedValue(new UnauthorizedError());
    const res = await DELETE(...req('DELETE', UUID));
    expect(res.status).toBe(401);
    expect(deleteDraft).not.toHaveBeenCalled();
  });

  it('404s a malformed id or a delete that matched no row', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    await expect(DELETE(...req('DELETE', 'nope'))).resolves.toMatchObject({ status: 404 });
    deleteDraft.mockResolvedValue(false);
    await expect(DELETE(...req('DELETE', UUID))).resolves.toMatchObject({ status: 404 });
  });

  it('returns ok for a removed owner-scoped row', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    deleteDraft.mockResolvedValue(true);
    const res = await DELETE(...req('DELETE', UUID));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(deleteDraft).toHaveBeenCalledWith('u1', UUID);
  });
});
