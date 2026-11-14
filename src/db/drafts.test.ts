import { beforeEach, describe, expect, it, vi } from 'vitest';

// The drizzle seam is mocked with tiny chainable stubs: these tests pin the drafts
// data-layer CONTRACT (creds guard, server-side identity derivation, update-or-insert
// fallback, owner-scoped deletes) — not Postgres itself. Mirrors the mocked-seam
// discipline of the API route tests.
const isDbConfigured = vi.fn();
const getDb = vi.fn();
vi.mock('./client', () => ({ isDbConfigured, getDb }));

const { draftTitle, saveDraft, listDrafts, getDraft, deleteDraft } = await import('./drafts');
const { createBlankQuoteDocument } = await import('@/domain/defaults');

beforeEach(() => {
  isDbConfigured.mockReset().mockReturnValue(true);
  getDb.mockReset();
});

/**
 * Chainable drizzle stub: every builder method (insert/values/set/where/returning/
 * select/from/orderBy/limit/delete/update) returns the same proxy and records its
 * arguments under `calls[name]`; awaiting the chain resolves to `result`.
 */
function chain(result: unknown) {
  const calls: Record<string, unknown[][]> = {};
  const target = Object.assign(Promise.resolve(result), { calls });
  const proxy: unknown = new Proxy(target, {
    get(t, prop) {
      if (prop in t || (typeof prop === 'symbol' && prop !== Symbol.toStringTag)) {
        const own = Reflect.get(t, prop);
        // Promise methods must run against the real promise, not the proxy receiver.
        return typeof own === 'function' ? own.bind(t) : own;
      }
      const name = String(prop); // only Symbol.toStringTag can reach here as a symbol
      const record = (...args: unknown[]) => {
        (calls[name] ??= []).push(args);
        return proxy;
      };
      // Configurable so a re-access may legally return a fresh bound wrapper.
      Object.defineProperty(t, prop, { value: record, configurable: true });
      return record;
    },
  });
  return proxy as typeof target & Record<string, (...args: unknown[]) => unknown>;
}

const doc = createBlankQuoteDocument();
doc.meta.docNo = 'ENCM-178-26-6824';
doc.client.name = 'Red Sea Coastal Resort';

describe('draftTitle', () => {
  it('joins doc number and client name with an em dash', () => {
    expect(draftTitle(doc)).toBe('ENCM-178-26-6824 — Red Sea Coastal Resort');
  });

  it('degrades to whichever half exists, then to a placeholder', () => {
    const noClient = { ...doc, client: { ...doc.client, name: '  ' } };
    expect(draftTitle(noClient)).toBe('ENCM-178-26-6824');
    const noDocNo = { ...noClient, meta: { ...noClient.meta, docNo: '' } };
    expect(draftTitle(noDocNo)).toBe('Untitled draft');
  });
});

describe('saveDraft', () => {
  it('no-ops to null when the DB is unconfigured', async () => {
    isDbConfigured.mockReturnValue(false);
    await expect(saveDraft({ userId: 'u1', step: 2, doc })).resolves.toBeNull();
    expect(getDb).not.toHaveBeenCalled();
  });

  it('inserts with identity columns derived from the validated doc', async () => {
    const inserted = chain([{ id: 'd1' }]);
    getDb.mockReturnValue({ insert: () => inserted });
    const id = await saveDraft({ userId: 'u1', step: 4, doc });
    expect(id).toBe('d1');
    expect(inserted.calls.values?.[0]?.[0]).toMatchObject({
      userId: 'u1',
      name: 'ENCM-178-26-6824 — Red Sea Coastal Resort',
      kind: 'quotation',
      number: 'ENCM-178-26-6824',
      clientName: 'Red Sea Coastal Resort',
      // Review-step saves normalize back to the terms step (FR-6.1 restore hygiene).
      step: 3,
      payload: { doc },
    });
  });

  it('updates in place when an id is given, falling through to insert when no row matched', async () => {
    const updateLeaf = chain([]); // owner-scoped update matched nothing (deleted/foreign id)
    getDb.mockReturnValue({ update: () => updateLeaf, insert: () => chain([{ id: 'd2' }]) });
    const id = await saveDraft({ userId: 'u1', id: 'gone', step: 2, doc });
    expect(id).toBe('d2');
    expect(updateLeaf.calls.set?.[0]?.[0]).toMatchObject({ step: 2 });

    getDb.mockReturnValue({ update: () => chain([{ id: 'd1' }]), insert: () => chain([{ id: 'nope' }]) });
    await expect(saveDraft({ userId: 'u1', id: 'd1', step: 2, doc })).resolves.toBe('d1');
  });

  it('swallows write failures (best-effort, never throws into the wizard)', async () => {
    getDb.mockImplementation(() => {
      throw new Error('boom');
    });
    await expect(saveDraft({ userId: 'u1', step: 1, doc })).resolves.toBeNull();
  });
});

describe('listDrafts / getDraft / deleteDraft', () => {
  const row = {
    id: 'd1',
    userId: 'u1',
    name: 'ENCM-178-26-6824 — Red Sea Coastal Resort',
    kind: 'quotation',
    number: 'ENCM-178-26-6824',
    clientName: 'Red Sea Coastal Resort',
    step: 2,
    payload: { schemaVersion: 2, doc },
    createdAt: new Date('2026-11-10T08:00:00Z'),
    updatedAt: new Date('2026-11-10T09:00:00Z'),
  };

  it('maps list rows to summaries without the payload', async () => {
    getDb.mockReturnValue({ select: () => chain([row]) });
    await expect(listDrafts('u1')).resolves.toEqual([
      {
        id: 'd1',
        name: row.name,
        kind: 'quotation',
        number: 'ENCM-178-26-6824',
        clientName: 'Red Sea Coastal Resort',
        step: 2,
        updatedAt: '2026-11-10T09:00:00.000Z',
      },
    ]);
  });

  it('clamps junk limits and caps the page', async () => {
    const leaf = chain([]);
    getDb.mockReturnValue({ select: () => leaf });
    await listDrafts('u1', 0);
    expect(leaf.calls.limit?.at(-1)?.[0]).toBe(1);
    await listDrafts('u1', 9999);
    expect(leaf.calls.limit?.at(-1)?.[0]).toBe(200);
  });

  it('getDraft returns the summary plus the doc, or null for unknown ids', async () => {
    getDb.mockReturnValue({ select: () => chain([row]) });
    const draft = await getDraft('u1', 'd1');
    expect(draft?.doc).toEqual(doc);
    expect(draft?.updatedAt).toBe('2026-11-10T09:00:00.000Z');

    getDb.mockReturnValue({ select: () => chain([]) });
    await expect(getDraft('u1', 'other')).resolves.toBeNull();
  });

  it('deleteDraft reports whether a row was actually removed', async () => {
    getDb.mockReturnValue({ delete: () => chain([{ id: 'd1' }]) });
    await expect(deleteDraft('u1', 'd1')).resolves.toBe(true);
    getDb.mockReturnValue({ delete: () => chain([]) });
    await expect(deleteDraft('u1', 'foreign')).resolves.toBe(false);
  });

  it('reads return empty results when the DB is unconfigured', async () => {
    isDbConfigured.mockReturnValue(false);
    await expect(listDrafts('u1')).resolves.toEqual([]);
    await expect(getDraft('u1', 'd1')).resolves.toBeNull();
    await expect(deleteDraft('u1', 'd1')).resolves.toBe(false);
  });
});
