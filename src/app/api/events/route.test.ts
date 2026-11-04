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
const EVENT_KINDS = ['exported', 'draft_saved', 'snapshot_saved', 'document_saved'] as const;
const DOC_KINDS = ['quotation', 'proforma'] as const;
vi.mock('@/db/activities', () => ({ logEvent, EVENT_KINDS, DOC_KINDS }));

const { POST } = await import('./route');
const { UnauthorizedError } = await import('@/auth/session');

beforeEach(() => {
  requireSessionUser.mockReset();
  logEvent.mockReset();
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
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(logEvent).toHaveBeenCalledWith({
      userId: 'u1',
      kind: 'exported',
      docKind: 'quotation',
      documentId: 'abc',
    });
  });

  it('still answers 202 when logging no-ops (best-effort telemetry)', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    logEvent.mockResolvedValue(false);
    const res = await POST(request({ kind: 'draft_saved' }));
    expect(res.status).toBe(202);
    await expect(res.json()).resolves.toEqual({ ok: false });
    expect(logEvent).toHaveBeenCalledWith({
      userId: 'u1',
      kind: 'draft_saved',
      docKind: null,
      documentId: null,
    });
  });
});
