import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the drizzle client behind a chainable query builder: the point of these
// tests is the module's own contract (guards, best-effort semantics, folding),
// not drizzle internals. `isDbConfigured` is flipped via dbConfigured. `values`
// returns a chainable so both logEvent (await .values) and saveDocument
// (.values.onConflictDoUpdate/.returning) resolve through the same seam.
const returning = vi.fn().mockResolvedValue([{ id: 'doc-1' }]);
const onConflictDoUpdate = vi.fn(() => ({ returning }));
const values = vi.fn(() => ({ onConflictDoUpdate, returning }));
const insert = vi.fn(() => ({ values }));
const groupBy = vi.fn().mockResolvedValue([]);
const where = vi.fn(() => ({ groupBy }));
const from = vi.fn(() => ({ where }));
const select = vi.fn(() => ({ from }));
const getDb = vi.fn(() => ({ insert, select }));
let dbConfigured = false;

vi.mock('@/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/db/client')>();
  return { ...actual, getDb, isDbConfigured: () => dbConfigured };
});

const { foldEventCounts, deriveKpis, logEvent, eventCounts, saveDocument } = await import('./activities');

beforeEach(() => {
  dbConfigured = false;
  values.mockReset();
  values.mockImplementation(() => ({ onConflictDoUpdate, returning }));
  onConflictDoUpdate.mockClear();
  returning.mockClear();
  returning.mockResolvedValue([{ id: 'doc-1' }]);
  insert.mockClear();
  select.mockClear();
  groupBy.mockResolvedValue([]);
});

describe('foldEventCounts (#10)', () => {
  it('folds grouped rows by type and exported-by-docKind', () => {
    const counts = foldEventCounts([
      { type: 'exported', docKind: 'quotation', n: 3 },
      { type: 'exported', docKind: 'proforma', n: 1 },
      { type: 'exported', docKind: null, n: 2 },
      { type: 'draft_saved', docKind: null, n: 7 },
      { type: 'snapshot_saved', docKind: 'quotation', n: 4 },
    ]);
    expect(counts.byType).toEqual({ exported: 6, draft_saved: 7, snapshot_saved: 4 });
    expect(counts.exportsByDocKind).toEqual({ quotation: 3, proforma: 1 });
    expect(counts.total).toBe(17);
  });

  it('ignores unknown types, docKinds and junk counts', () => {
    const counts = foldEventCounts([
      { type: 'something_else', docKind: 'quotation', n: 5 },
      { type: 'exported', docKind: 'unknown-kind', n: 2 }, // counted, but not tiled per-docKind
      { type: 'exported', docKind: 'quotation', n: 0 },
      { type: 'draft_saved', docKind: null, n: Number.NaN },
    ]);
    expect(counts.byType).toEqual({ exported: 2 });
    expect(counts.exportsByDocKind).toEqual({});
    expect(counts.total).toBe(2);
  });

  it('handles the empty result (no events yet / unconfigured DB)', () => {
    expect(foldEventCounts([])).toEqual({ byType: {}, exportsByDocKind: {}, total: 0 });
  });
});

describe('deriveKpis (#10)', () => {
  it('maps the fold onto the three landing tiles', () => {
    const kpis = deriveKpis(
      foldEventCounts([
        { type: 'exported', docKind: 'quotation', n: 12 },
        { type: 'exported', docKind: 'proforma', n: 5 },
        { type: 'draft_saved', docKind: null, n: 9 },
        { type: 'snapshot_saved', docKind: null, n: 100 },
      ]),
    );
    expect(kpis).toEqual({ quotationsGenerated: 12, proformasGenerated: 5, draftsSaved: 9 });
  });

  it('zero-fills missing tiles instead of undefined', () => {
    expect(deriveKpis(foldEventCounts([]))).toEqual({
      quotationsGenerated: 0,
      proformasGenerated: 0,
      draftsSaved: 0,
    });
  });
});

describe('logEvent (#10)', () => {
  it('is a best-effort no-op when the DB is not configured (never throws)', async () => {
    await expect(logEvent({ userId: 'u1', kind: 'exported' })).resolves.toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it('inserts a scoped row when configured', async () => {
    dbConfigured = true;
    const ok = await logEvent({
      userId: 'u1',
      kind: 'exported',
      docKind: 'quotation',
      documentId: '2f4a6b8c-1d2e-3f4a-5b6c-7d8e9f0a1b2c',
    });
    expect(ok).toBe(true);
    expect(values).toHaveBeenCalledWith({
      userId: 'u1',
      type: 'exported',
      docKind: 'quotation',
      documentId: '2f4a6b8c-1d2e-3f4a-5b6c-7d8e9f0a1b2c',
    });
  });

  it('drops non-uuid documentId (the column is uuid; a bad value must not sink the write)', async () => {
    dbConfigured = true;
    await expect(
      logEvent({ userId: 'u1', kind: 'draft_saved', documentId: 'localStorage-key-1' }),
    ).resolves.toBe(true);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ documentId: null, docKind: null }));
  });

  it('swallows insert failures and returns false', async () => {
    dbConfigured = true;
    values.mockRejectedValueOnce(new Error('connection reset'));
    await expect(logEvent({ userId: 'u1', kind: 'exported' })).resolves.toBe(false);
  });
});

describe('eventCounts (#10)', () => {
  it('returns an empty fold without touching the DB when unconfigured', async () => {
    await expect(eventCounts('u1')).resolves.toEqual({ byType: {}, exportsByDocKind: {}, total: 0 });
    expect(select).not.toHaveBeenCalled();
  });

  it('queries grouped by type and docKind for the scoped user', async () => {
    dbConfigured = true;
    groupBy.mockResolvedValueOnce([{ type: 'draft_saved', docKind: null, n: '2' }] as never);
    const counts = await eventCounts('u1');
    expect(select).toHaveBeenCalled();
    expect(groupBy).toHaveBeenCalled();
    expect(counts.byType.draft_saved).toBe(2); // string counts from Postgres coerce fine
  });
});

describe('saveDocument (#10 slice 3)', () => {
  it('is a best-effort no-op (null) when the DB is not configured', async () => {
    await expect(
      saveDocument({ userId: 'u1', kind: 'quotation', number: 'ENCM-26-6879', payload: {} }),
    ).resolves.toBeNull();
    expect(insert).not.toHaveBeenCalled();
  });

  it('upserts on the (userId, kind, number) business key and returns the row id', async () => {
    dbConfigured = true;
    const id = await saveDocument({
      userId: 'u1',
      kind: 'quotation',
      number: 'ENCM-26-6879',
      clientName: 'Turtle Bay',
      payload: { meta: { docNo: 'ENCM-26-6879' } },
    });
    expect(id).toBe('doc-1');
    expect(onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.any(Array),
        set: expect.objectContaining({ clientName: 'Turtle Bay' }),
      }),
    );
  });

  it('plain-inserts (no upsert) when the document has no number', async () => {
    dbConfigured = true;
    const id = await saveDocument({ userId: 'u1', kind: 'proforma', number: null, payload: {} });
    expect(id).toBe('doc-1');
    expect(onConflictDoUpdate).not.toHaveBeenCalled();
  });

  it('trims a blank number to the no-key path', async () => {
    dbConfigured = true;
    await saveDocument({ userId: 'u1', kind: 'quotation', number: '   ', payload: {} });
    expect(onConflictDoUpdate).not.toHaveBeenCalled();
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ number: null }));
  });

  it('swallows write failures and returns null', async () => {
    dbConfigured = true;
    returning.mockRejectedValueOnce(new Error('unique violation'));
    await expect(
      saveDocument({ userId: 'u1', kind: 'quotation', number: 'X', payload: {} }),
    ).resolves.toBeNull();
  });
});
