import { beforeEach, describe, expect, it, vi } from 'vitest';

// Session + data seams are mocked: these tests pin the HTTP contract of the
// single-document handler (401 / 404 for bad-or-unknown id / 200 with payload).
const requireSessionUser = vi.fn();
vi.mock('@/auth/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/auth/session')>();
  return { ...actual, requireSessionUser };
});

const getDocument = vi.fn();
vi.mock('@/db/activities', () => ({ getDocument }));

const { GET } = await import('./route');
const { UnauthorizedError } = await import('@/auth/session');

const UUID = '2f4a6b8c-1d2e-3f4a-5b6c-7d8e9f0a1b2c';

beforeEach(() => {
  requireSessionUser.mockReset();
  getDocument.mockReset();
});

function get(id: string): Parameters<typeof GET>[1] {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/documents/[id] (#12 slice 1)', () => {
  it('is force-dynamic (user-scoped reads are never prerendered)', async () => {
    expect((await import('./route')).dynamic).toBe('force-dynamic');
  });

  it('returns 401 when signed out and never queries', async () => {
    requireSessionUser.mockRejectedValue(new UnauthorizedError());
    const res = await GET(new Request('http://localhost/api/documents/x'), get(UUID));
    expect(res.status).toBe(401);
    expect(getDocument).not.toHaveBeenCalled();
  });

  it('returns 404 for a malformed (non-uuid) id without a query', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    const res = await GET(new Request('http://localhost/api/documents/nope'), get('nope'));
    expect(res.status).toBe(404);
    expect(getDocument).not.toHaveBeenCalled();
  });

  it('returns 404 when no row matches (unknown id or another user)', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    getDocument.mockResolvedValue(null);
    const res = await GET(new Request(`http://localhost/api/documents/${UUID}`), get(UUID));
    expect(res.status).toBe(404);
    // scoped to the session user, not the raw id alone
    expect(getDocument).toHaveBeenCalledWith('u1', UUID);
  });

  it('returns the scoped { summary, payload } when found', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    const doc = {
      summary: { id: UUID, kind: 'quotation', number: 'ENCM-1', clientName: 'ACME', createdAt: '2026-11-04T10:00:00.000Z' },
      payload: { doc: { meta: { docNo: 'ENCM-1' } }, profile: { legalNameEn: 'ENC' } },
    };
    getDocument.mockResolvedValue(doc);
    const res = await GET(new Request(`http://localhost/api/documents/${UUID}`), get(UUID));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(doc);
  });
});
