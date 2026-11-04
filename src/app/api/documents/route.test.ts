import { beforeEach, describe, expect, it, vi } from 'vitest';

// Session + data seams are mocked: these tests pin the HTTP contract of the list
// handler (force-dynamic / 401 / 200 {items} / limit parsing), not auth or drizzle.
const requireSessionUser = vi.fn();
vi.mock('@/auth/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/auth/session')>();
  return { ...actual, requireSessionUser };
});

const listDocuments = vi.fn();
const DOC_LIST_LIMIT = 50;
vi.mock('@/db/activities', () => ({ listDocuments, DOC_LIST_LIMIT }));

const { GET } = await import('./route');
const { UnauthorizedError } = await import('@/auth/session');

beforeEach(() => {
  requireSessionUser.mockReset();
  listDocuments.mockReset();
});

function request(url = 'http://localhost/api/documents'): Request {
  return new Request(url);
}

describe('GET /api/documents (#12 slice 1)', () => {
  it('is force-dynamic (user-scoped reads are never prerendered)', async () => {
    expect((await import('./route')).dynamic).toBe('force-dynamic');
  });

  it('returns 401 when signed out (requireSessionUser throws) and never queries', async () => {
    requireSessionUser.mockRejectedValue(new UnauthorizedError());
    const res = await GET(request());
    expect(res.status).toBe(401);
    expect(listDocuments).not.toHaveBeenCalled();
  });

  it('returns the user-scoped summary list (payload omitted) with the default limit', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    const items = [{ id: 'a', kind: 'quotation', number: 'ENCM-1', clientName: 'ACME', createdAt: '2026-11-04T10:00:00.000Z' }];
    listDocuments.mockResolvedValue(items);
    const res = await GET(request());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ items });
    expect(listDocuments).toHaveBeenCalledWith('u1', DOC_LIST_LIMIT);
  });

  it('honors a valid ?limit= query param', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    listDocuments.mockResolvedValue([]);
    await GET(request('http://localhost/api/documents?limit=10'));
    expect(listDocuments).toHaveBeenCalledWith('u1', 10);
  });

  it('falls back to the default limit for a junk ?limit=', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    listDocuments.mockResolvedValue([]);
    await GET(request('http://localhost/api/documents?limit=nope'));
    expect(listDocuments).toHaveBeenCalledWith('u1', DOC_LIST_LIMIT);
    await GET(request('http://localhost/api/documents?limit=0'));
    expect(listDocuments).toHaveBeenLastCalledWith('u1', DOC_LIST_LIMIT);
  });
});
