import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The auth client seam is mocked (its own behaviour is covered by client.test.ts);
// these tests pin the telemetry contract: session-first, best-effort, correct body.
const getSession = vi.fn();
vi.mock('@/auth/client', () => ({ getSession }));

const { logActivity } = await import('./telemetry');

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;

beforeEach(() => {
  getSession.mockReset();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(Response.json({ ok: true }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

describe('logActivity (#10 slice 2)', () => {
  it('makes no API call when there is no session (anonymous / unconfigured auth)', async () => {
    getSession.mockResolvedValue({ data: null });
    await logActivity('exported', { docKind: 'quotation' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('swallows getSession failures instead of throwing at the caller', async () => {
    getSession.mockRejectedValue(new Error('network down'));
    await expect(logActivity('draft_saved')).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts the event with the full payload when signed in', async () => {
    getSession.mockResolvedValue({ data: { user: { id: 'u1' } } });
    await logActivity('exported', { docKind: 'proforma', documentId: 'doc-1' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/events',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'exported', docKind: 'proforma', documentId: 'doc-1' }),
      }),
    );
  });

  it('null-fills optional doc fields', async () => {
    getSession.mockResolvedValue({ data: { user: { id: 'u1' } } });
    await logActivity('draft_saved');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/events',
      expect.objectContaining({
        body: JSON.stringify({ kind: 'draft_saved', docKind: null, documentId: null }),
      }),
    );
  });

  it('never throws when the API call fails (telemetry must not break exports)', async () => {
    getSession.mockResolvedValue({ data: { user: { id: 'u1' } } });
    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(logActivity('snapshot_saved', { docKind: 'quotation' })).resolves.toBeUndefined();
  });

  it('treats a session-shaped data without a user as anonymous', async () => {
    getSession.mockResolvedValue({ data: { user: null } });
    await logActivity('exported');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
