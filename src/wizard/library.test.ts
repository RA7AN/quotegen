import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The auth client seam is mocked; these tests pin the library contract: session-first
// (no calls when anonymous), best-effort reads ([]), correct request shape, and never
// throwing on network failure. The UI wiring lives in the (jsdom-deferred) wizard.
const getSession = vi.fn();
vi.mock('@/auth/client', () => ({ getSession }));

const { fetchClients, saveClient, removeClient, fetchSignoffs, saveSignoff, removeSignoff } =
  await import('./library');

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;

const signedIn = () => getSession.mockResolvedValue({ data: { user: { id: 'u1' } } });
const anonymous = () => getSession.mockResolvedValue({ data: null });

beforeEach(() => {
  getSession.mockReset();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(Response.json({ items: [] }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

describe('fetchClients (#11 slice 3)', () => {
  it('makes no request when anonymous and resolves []', async () => {
    anonymous();
    expect(await fetchClients()).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('GETs the endpoint and returns items when signed in', async () => {
    signedIn();
    const items = [{ id: 'c1', name: 'ACME', custId: '1', data: { name: 'ACME' }, updatedAt: 'x' }];
    fetchMock.mockResolvedValue(Response.json({ items }));
    const out = await fetchClients();
    expect(out).toEqual(items);
    expect(fetchMock).toHaveBeenCalledWith('/api/clients', expect.objectContaining({ method: 'GET' }));
  });

  it('resolves [] on a non-2xx or a fetch failure (best-effort)', async () => {
    signedIn();
    fetchMock.mockResolvedValue(new Response('{}', { status: 500 }));
    expect(await fetchClients()).toEqual([]);
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await fetchClients()).toEqual([]);
  });
});

describe('saveClient / removeClient (#11 slice 3)', () => {
  it('POSTs the client JSON and returns the accepted flag', async () => {
    signedIn();
    fetchMock.mockResolvedValue(Response.json({ ok: true, id: 'c1' }));
    const client = { name: 'ACME', addressLines: [], custId: '1', city: '', crNo: '' };
    expect(await saveClient(client)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/clients',
      expect.objectContaining({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(client) }),
    );
  });

  it('DELETEs the id path and is false when anonymous', async () => {
    signedIn();
    fetchMock.mockResolvedValue(Response.json({ ok: true }));
    expect(await removeClient('c 1')).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('/api/clients/c%201', expect.objectContaining({ method: 'DELETE' }));

    anonymous();
    expect(await removeClient('c1')).toBe(false);
  });

  it('returns false (never throws) when the request fails', async () => {
    signedIn();
    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(saveClient({ name: 'X', addressLines: [], custId: '', city: '', crNo: '' })).resolves.toBe(false);
  });
});

describe('sign-off seam (#11 slice 3)', () => {
  it('fetches [] when anonymous; GETs the signoff endpoint when signed in', async () => {
    anonymous();
    expect(await fetchSignoffs()).toEqual([]);
    signedIn();
    const items = [{ id: 'b1', label: 'M', data: { name: 'M' }, updatedAt: 'x' }];
    fetchMock.mockResolvedValue(Response.json({ items }));
    expect(await fetchSignoffs()).toEqual(items);
    expect(fetchMock).toHaveBeenCalledWith('/api/signoff-blocks', expect.objectContaining({ method: 'GET' }));
  });

  it('POSTs a block and DELETEs by id', async () => {
    signedIn();
    fetchMock.mockResolvedValue(Response.json({ ok: true, id: 'b1' }));
    const block = { signoff: 'Regards', name: 'M', org: '', mobile: '', email: 'm@x.com', website: '' };
    expect(await saveSignoff(block)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('/api/signoff-blocks', expect.objectContaining({ method: 'POST', body: JSON.stringify(block) }));

    fetchMock.mockResolvedValue(Response.json({ ok: true }));
    expect(await removeSignoff('b1')).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('/api/signoff-blocks/b1', expect.objectContaining({ method: 'DELETE' }));
  });
});
