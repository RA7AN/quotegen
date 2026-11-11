import { beforeEach, describe, expect, it, vi } from 'vitest';

// Session + data seams mocked: these tests pin the HTTP contract of the next-number
// handler (force-dynamic / 401 / 400 on bad template / 200 {seq} on success).
const requireSessionUser = vi.fn();
vi.mock('@/auth/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/auth/session')>();
  return { ...actual, requireSessionUser };
});

const nextSeqFor = vi.fn();
const DOC_KINDS = ['quotation', 'proforma'] as const;
vi.mock('@/db/activities', () => ({ nextSeqFor, DOC_KINDS }));

const { GET, dynamic } = await import('./route');
const { UnauthorizedError } = await import('@/auth/session');

beforeEach(() => {
  requireSessionUser.mockReset();
  nextSeqFor.mockReset();
});

function request(url = 'http://localhost/api/documents/next-number?template=quotation'): Request {
  return new Request(url);
}

describe('GET /api/documents/next-number (wizard doc-number split slice 2)', () => {
  it('is force-dynamic (per-user reads must never prerender)', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  it('returns 401 when signed out (requireSessionUser throws) and never queries', async () => {
    requireSessionUser.mockRejectedValue(new UnauthorizedError());
    const res = await GET(request());
    expect(res.status).toBe(401);
    expect(nextSeqFor).not.toHaveBeenCalled();
  });

  it('returns 400 when the template query param is missing', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    const res = await GET(new Request('http://localhost/api/documents/next-number'));
    expect(res.status).toBe(400);
    expect(nextSeqFor).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining('template') });
  });

  it('returns 400 when the template is not a known doc kind', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    const res = await GET(request('http://localhost/api/documents/next-number?template=bogus'));
    expect(res.status).toBe(400);
    expect(nextSeqFor).not.toHaveBeenCalled();
  });

  it('returns 200 {seq} for a valid quotation request', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    nextSeqFor.mockResolvedValue('6880');
    const res = await GET(request('http://localhost/api/documents/next-number?template=quotation'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ seq: '6880' });
    expect(nextSeqFor).toHaveBeenCalledWith('u1', 'quotation');
  });

  it('returns 200 {seq} for a valid proforma request', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    nextSeqFor.mockResolvedValue('5800');
    const res = await GET(request('http://localhost/api/documents/next-number?template=proforma'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ seq: '5800' });
    expect(nextSeqFor).toHaveBeenCalledWith('u1', 'proforma');
  });
});
