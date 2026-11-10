import { beforeEach, describe, expect, it, vi } from 'vitest';

// Session + data seams are mocked: these tests pin the HTTP contract of the clients
// handlers (force-dynamic / 401 / 200 {items} / 202 upsert / 400 body validation),
// not auth or drizzle.
const requireSessionUser = vi.fn();
vi.mock('@/auth/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/auth/session')>();
  return { ...actual, requireSessionUser };
});

const listClients = vi.fn();
const upsertClient = vi.fn();
const CLIENT_LIST_LIMIT = 50;
vi.mock('@/db/clients', () => ({ listClients, upsertClient, CLIENT_LIST_LIMIT }));

const { GET, POST } = await import('./route');
const { UnauthorizedError } = await import('@/auth/session');

beforeEach(() => {
  requireSessionUser.mockReset();
  listClients.mockReset();
  upsertClient.mockReset();
});

function get(url = 'http://localhost/api/clients'): Request {
  return new Request(url);
}
function post(body: unknown): Request {
  return new Request('http://localhost/api/clients', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const validClient = { name: 'ACME Hotel', addressLines: ['Street 1'], custId: '0020TBH', city: 'Jeddah', crNo: '4701' };

describe('GET /api/clients (#11 slice 1)', () => {
  it('is force-dynamic (user-scoped reads are never prerendered)', async () => {
    expect((await import('./route')).dynamic).toBe('force-dynamic');
  });

  it('returns 401 when signed out and never queries', async () => {
    requireSessionUser.mockRejectedValue(new UnauthorizedError());
    const res = await GET(get());
    expect(res.status).toBe(401);
    expect(listClients).not.toHaveBeenCalled();
  });

  it('returns the user-scoped list with the default limit', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    const items = [{ id: 'c1', name: 'ACME', custId: '1', data: validClient, updatedAt: '2026-11-04T10:00:00.000Z' }];
    listClients.mockResolvedValue(items);
    const res = await GET(get());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ items });
    expect(listClients).toHaveBeenCalledWith('u1', CLIENT_LIST_LIMIT);
  });

  it('honors a valid ?limit= and falls back for junk', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    listClients.mockResolvedValue([]);
    await GET(get('http://localhost/api/clients?limit=10'));
    expect(listClients).toHaveBeenLastCalledWith('u1', 10);
    await GET(get('http://localhost/api/clients?limit=nope'));
    expect(listClients).toHaveBeenLastCalledWith('u1', CLIENT_LIST_LIMIT);
  });
});

describe('POST /api/clients (#11 slice 1)', () => {
  it('returns 401 when signed out', async () => {
    requireSessionUser.mockRejectedValue(new UnauthorizedError());
    const res = await POST(post(validClient));
    expect(res.status).toBe(401);
    expect(upsertClient).not.toHaveBeenCalled();
  });

  it('returns 400 on a non-JSON body', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    const res = await POST(post('{nope'));
    expect(res.status).toBe(400);
    expect(upsertClient).not.toHaveBeenCalled();
  });

  it('returns 400 when the body fails ClientSchema (missing name, AC-12)', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    const res = await POST(post({ custId: '1' }));
    expect(res.status).toBe(400);
    expect(upsertClient).not.toHaveBeenCalled();
  });

  it('upserts the validated client for the session user and returns 202 with the id', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    upsertClient.mockResolvedValue('c1');
    const res = await POST(post(validClient));
    expect(res.status).toBe(202);
    await expect(res.json()).resolves.toEqual({ ok: true, id: 'c1' });
    expect(upsertClient).toHaveBeenCalledWith({ userId: 'u1', client: validClient });
  });

  it('still answers 202 (ok:false) when the upsert no-ops (DB unconfigured / failed)', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    upsertClient.mockResolvedValue(null);
    const res = await POST(post(validClient));
    expect(res.status).toBe(202);
    await expect(res.json()).resolves.toEqual({ ok: false, id: null });
  });
});
