import { beforeEach, describe, expect, it, vi } from 'vitest';

// Session + data seams are mocked: these tests pin the HTTP contract of the drafts
// handlers (force-dynamic / 401 / 200 {items} / 202 save with server-derived title /
// 400 body validation), not auth or drizzle. Mirrors the clients route tests.
const requireSessionUser = vi.fn();
vi.mock('@/auth/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/auth/session')>();
  return { ...actual, requireSessionUser };
});

const listDrafts = vi.fn();
const saveDraft = vi.fn();
const draftTitle = vi.fn((doc: { meta: { docNo: string }; client: { name: string } }) =>
  [doc.meta.docNo.trim(), doc.client.name.trim()].filter(Boolean).join(' — ') || 'Untitled draft',
);
const DRAFT_LIST_LIMIT = 50;
vi.mock('@/db/drafts', () => ({ listDrafts, saveDraft, draftTitle, DRAFT_LIST_LIMIT }));

const { GET, POST } = await import('./route');
const { UnauthorizedError } = await import('@/auth/session');
const { createBlankQuoteDocument } = await import('@/domain/defaults');

beforeEach(() => {
  requireSessionUser.mockReset();
  listDrafts.mockReset();
  saveDraft.mockReset();
});

function get(url = 'http://localhost/api/drafts'): Request {
  return new Request(url);
}
function post(body: unknown): Request {
  return new Request('http://localhost/api/drafts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const validDoc = createBlankQuoteDocument();
validDoc.meta.docNo = 'ENCM-178-26-6824';
validDoc.meta.quoteDateISO = '2026-11-10';
validDoc.meta.validUntilISO = '2026-12-10';
validDoc.client.name = 'Red Sea Coastal Resort';

describe('GET /api/drafts (multi-drafts slice)', () => {
  it('is force-dynamic (user-scoped reads are never prerendered)', async () => {
    expect((await import('./route')).dynamic).toBe('force-dynamic');
  });

  it('returns 401 when signed out and never queries', async () => {
    requireSessionUser.mockRejectedValue(new UnauthorizedError());
    const res = await GET(get());
    expect(res.status).toBe(401);
    expect(listDrafts).not.toHaveBeenCalled();
  });

  it('returns the user-scoped summaries with the default limit', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    const items = [{ id: 'd1', name: 'ENCM-26-6824 — ACME', kind: 'quotation', step: 2, updatedAt: 'x' }];
    listDrafts.mockResolvedValue(items);
    const res = await GET(get());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ items });
    expect(listDrafts).toHaveBeenCalledWith('u1', DRAFT_LIST_LIMIT);
  });

  it('honors a valid ?limit= and falls back for junk', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    listDrafts.mockResolvedValue([]);
    await GET(get('http://localhost/api/drafts?limit=3'));
    expect(listDrafts).toHaveBeenLastCalledWith('u1', 3);
    await GET(get('http://localhost/api/drafts?limit=-1'));
    expect(listDrafts).toHaveBeenLastCalledWith('u1', DRAFT_LIST_LIMIT);
  });
});

describe('POST /api/drafts (multi-drafts slice)', () => {
  it('returns 401 when signed out', async () => {
    requireSessionUser.mockRejectedValue(new UnauthorizedError());
    const res = await POST(post({ step: 1, doc: validDoc }));
    expect(res.status).toBe(401);
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it('returns 400 on a non-JSON body', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    const res = await POST(post('{nope'));
    expect(res.status).toBe(400);
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it('returns 400 when the doc fails DraftDocSchema structurally (AC-12)', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    // Unknown template enum + a fractional line price break the RENDER guarantees,
    // even though a blank docNo/name stay legal for a half-typed draft.
    const res = await POST(post({ step: 1, doc: { ...validDoc, template: 'invoice' } }));
    expect(res.status).toBe(400);
    expect(saveDraft).not.toHaveBeenCalled();
    await expect(
      POST(post({ step: 1, doc: { ...validDoc, lines: [{ id: 'l1', description: 'x', uom: '', qtyHundredths: 1, unitPriceHalalas: 1.5 } ] } })),
    ).resolves.toMatchObject({ status: 400 });
  });

  it('accepts a half-typed draft (empty docNo/client pass the lenient schema)', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    saveDraft.mockResolvedValue('d0');
    const blank = createBlankQuoteDocument();
    const res = await POST(post({ step: 1, doc: blank }));
    expect(res.status).toBe(202);
    await expect(res.json()).resolves.toMatchObject({ ok: true, name: 'Untitled draft' });
  });

  it('returns 400 for an out-of-range step or malformed id', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    await expect(POST(post({ step: 9, doc: validDoc }))).resolves.toMatchObject({ status: 400 });
    await expect(POST(post({ id: 'not-a-uuid', step: 1, doc: validDoc }))).resolves.toMatchObject({ status: 400 });
  });

  it('saves a new draft for the session user and echoes id + derived title (202)', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    saveDraft.mockResolvedValue('d1');
    const res = await POST(post({ step: 2, doc: validDoc }));
    expect(res.status).toBe(202);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      id: 'd1',
      name: 'ENCM-178-26-6824 — Red Sea Coastal Resort',
    });
    expect(saveDraft).toHaveBeenCalledWith({ userId: 'u1', id: undefined, step: 2, doc: validDoc });
  });

  it('updates in place when a valid id is supplied', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    saveDraft.mockResolvedValue('d1');
    const id = '00000000-0000-4000-8000-000000000001';
    const res = await POST(post({ id, step: 3, doc: validDoc }));
    expect(res.status).toBe(202);
    expect(saveDraft).toHaveBeenCalledWith({ userId: 'u1', id, step: 3, doc: validDoc });
  });

  it('still answers 202 (ok:false) when the save no-ops (DB unconfigured / failed)', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    saveDraft.mockResolvedValue(null);
    const res = await POST(post({ step: 1, doc: validDoc }));
    expect(res.status).toBe(202);
    await expect(res.json()).resolves.toMatchObject({ ok: false, id: null });
  });
});
