import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireSessionUser = vi.fn();
vi.mock('@/auth/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/auth/session')>();
  return { ...actual, requireSessionUser };
});

const listSignoffBlocks = vi.fn();
const upsertSignoffBlock = vi.fn();
const SIGNOFF_LIST_LIMIT = 50;
vi.mock('@/db/signoff', () => ({ listSignoffBlocks, upsertSignoffBlock, SIGNOFF_LIST_LIMIT }));

const { GET, POST } = await import('./route');
const { UnauthorizedError } = await import('@/auth/session');

beforeEach(() => {
  requireSessionUser.mockReset();
  listSignoffBlocks.mockReset();
  upsertSignoffBlock.mockReset();
});

function get(url = 'http://localhost/api/signoff-blocks'): Request {
  return new Request(url);
}
function post(body: unknown): Request {
  return new Request('http://localhost/api/signoff-blocks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const validBlock = { signoff: 'Best regards,', name: 'Mithun', org: 'ENCM', mobile: '0500', email: 'm@encm.sa', website: 'encm.sa' };

describe('GET /api/signoff-blocks (#11 slice 2)', () => {
  it('is force-dynamic', async () => {
    expect((await import('./route')).dynamic).toBe('force-dynamic');
  });

  it('returns 401 when signed out and never queries', async () => {
    requireSessionUser.mockRejectedValue(new UnauthorizedError());
    expect((await GET(get())).status).toBe(401);
    expect(listSignoffBlocks).not.toHaveBeenCalled();
  });

  it('returns the user-scoped list with the default limit and honors ?limit=', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    const items = [{ id: 'b1', label: 'Mithun', data: validBlock, updatedAt: '2026-11-04T10:00:00.000Z' }];
    listSignoffBlocks.mockResolvedValue(items);
    const res = await GET(get());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ items });
    expect(listSignoffBlocks).toHaveBeenLastCalledWith('u1', SIGNOFF_LIST_LIMIT);
    await GET(get('http://localhost/api/signoff-blocks?limit=5'));
    expect(listSignoffBlocks).toHaveBeenLastCalledWith('u1', 5);
  });
});

describe('POST /api/signoff-blocks (#11 slice 2)', () => {
  it('returns 401 when signed out', async () => {
    requireSessionUser.mockRejectedValue(new UnauthorizedError());
    expect((await POST(post(validBlock))).status).toBe(401);
    expect(upsertSignoffBlock).not.toHaveBeenCalled();
  });

  it('returns 400 on a non-JSON body and on a ClosingSchema failure (missing field, AC-12)', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    expect((await POST(post('{nope'))).status).toBe(400);
    expect((await POST(post({ signoff: 'x', org: '', mobile: '', email: '', website: '' }))).status).toBe(400); // name missing
    expect(upsertSignoffBlock).not.toHaveBeenCalled();
  });

  it('upserts the validated block for the session user and returns 202 with the id', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    upsertSignoffBlock.mockResolvedValue('b1');
    const res = await POST(post(validBlock));
    expect(res.status).toBe(202);
    await expect(res.json()).resolves.toEqual({ ok: true, id: 'b1' });
    expect(upsertSignoffBlock).toHaveBeenCalledWith({ userId: 'u1', block: validBlock });
  });

  it('still answers 202 (ok:false) when the upsert no-ops', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    upsertSignoffBlock.mockResolvedValue(null);
    const res = await POST(post(validBlock));
    expect(res.status).toBe(202);
    await expect(res.json()).resolves.toEqual({ ok: false, id: null });
  });
});
