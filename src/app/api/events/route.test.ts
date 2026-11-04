import { beforeEach, describe, expect, it, vi } from 'vitest';

// Session and data seams are mocked: the point of these tests is the HTTP contract
// of the handler (401 / 400 / 202 semantics + payload pass-through), not auth or
// drizzle internals.
const requireSessionUser = vi.fn();
vi.mock('@/auth/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/auth/session')>();
  return { ...actual, requireSessionUser };
});

const logEvent = vi.fn();
const saveDocument = vi.fn();
const EVENT_KINDS = ['exported', 'draft_saved', 'snapshot_saved', 'document_saved'] as const;
const DOC_KINDS = ['quotation', 'proforma'] as const;
vi.mock('@/db/activities', () => ({ logEvent, saveDocument, EVENT_KINDS, DOC_KINDS }));

const { POST } = await import('./route');
const { UnauthorizedError } = await import('@/auth/session');

beforeEach(() => {
  requireSessionUser.mockReset();
  logEvent.mockReset();
  saveDocument.mockReset();
});

function request(body: unknown): Request {
  return new Request('http://localhost/api/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/events (#10 slice 1)', () => {
  it('is force-dynamic (write endpoints are never prerendered)', async () => {
    expect((await import('./route')).dynamic).toBe('force-dynamic');
  });

  it('returns 401 when signed out (requireSessionUser throws)', async () => {
    requireSessionUser.mockRejectedValue(new UnauthorizedError());
    const res = await POST(request({ kind: 'exported' }));
    expect(res.status).toBe(401);
    expect(logEvent).not.toHaveBeenCalled();
  });

  it('returns 400 on a non-JSON body', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    const res = await POST(request('{nope'));
    expect(res.status).toBe(400);
    expect(logEvent).not.toHaveBeenCalled();
  });

  it('returns 400 on an unknown event kind (boundary schema, AC-12)', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    const res = await POST(request({ kind: 'definitely_not_a_kind' }));
    expect(res.status).toBe(400);
    expect(logEvent).not.toHaveBeenCalled();
  });

  it('logs a valid event scoped to the session user and returns 202', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    logEvent.mockResolvedValue(true);
    const res = await POST(
      request({ kind: 'exported', docKind: 'quotation', documentId: 'abc' }),
    );
    expect(res.status).toBe(202);
    await expect(res.json()).resolves.toEqual({ ok: true, documentId: 'abc' });
    expect(logEvent).toHaveBeenCalledWith({
      userId: 'u1',
      kind: 'exported',
      docKind: 'quotation',
      documentId: 'abc',
    });
  });

  it('persists the document row for a document_saved event and links the row id', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    saveDocument.mockResolvedValue('row-9');
    logEvent.mockResolvedValue(true);
    const res = await POST(
      request({
        kind: 'document_saved',
        docKind: 'quotation',
        payload: { meta: { docNo: 'ENCM-26-6879' }, client: { name: 'Turtle Bay' } },
      }),
    );
    expect(res.status).toBe(202);
    await expect(res.json()).resolves.toEqual({ ok: true, documentId: 'row-9' });
    expect(saveDocument).toHaveBeenCalledWith({
      userId: 'u1',
      kind: 'quotation',
      number: 'ENCM-26-6879',
      clientName: 'Turtle Bay',
      payload: { meta: { docNo: 'ENCM-26-6879' }, client: { name: 'Turtle Bay' } },
    });
    // event links to the fresh row id, not the (absent) client echo
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ documentId: 'row-9' }));
  });

  it('does not persist for non-document kinds even with a stray payload', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    logEvent.mockResolvedValue(true);
    const res = await POST(request({ kind: 'exported', docKind: 'quotation', payload: { x: 1 } }));
    expect(res.status).toBe(202);
    expect(saveDocument).not.toHaveBeenCalled();
  });

  it('logs the event with a null id when persistence fails (best-effort)', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    saveDocument.mockResolvedValue(null); // DB unconfigured / write failed
    logEvent.mockResolvedValue(false);
    const res = await POST(request({ kind: 'document_saved', docKind: 'quotation', payload: {} }));
    expect(res.status).toBe(202);
    await expect(res.json()).resolves.toEqual({ ok: false, documentId: null });
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ documentId: null }));
  });

  it('still answers 202 when logging no-ops (best-effort telemetry)', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    logEvent.mockResolvedValue(false);
    const res = await POST(request({ kind: 'draft_saved' }));
    expect(res.status).toBe(202);
    await expect(res.json()).resolves.toEqual({ ok: false, documentId: null });
    expect(logEvent).toHaveBeenCalledWith({
      userId: 'u1',
      kind: 'draft_saved',
      docKind: null,
      documentId: null,
    });
  });
});
