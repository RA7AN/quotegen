import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the drizzle client behind a chainable builder: these tests pin clients.ts's own
// contract (creds guard, dedupe upsert shape, best-effort semantics), not drizzle.
//   insert: .values(row).onConflictDoUpdate(..).returning(..)   (upsertClient)
//   select: .from(..).where(..).orderBy(..).limit(..)           (listClients)
//   delete: .delete(table).where(..).returning(..)              (deleteClient)
let rows: unknown[] = [];
const resolveRows = () => Promise.resolve(rows);
const returning = vi.fn(resolveRows);
const onConflictDoUpdate = vi.fn(() => ({ returning }));
const values = vi.fn(() => ({ onConflictDoUpdate, returning }));
const insert = vi.fn(() => ({ values }));
const limit = vi.fn(resolveRows);
const orderBy = vi.fn(() => ({ limit }));
const where = vi.fn(() => ({ orderBy }));
const from = vi.fn(() => ({ where }));
const select = vi.fn(() => ({ from }));
const delReturning = vi.fn(resolveRows);
const delWhere = vi.fn(() => ({ returning: delReturning }));
const del = vi.fn(() => ({ where: delWhere }));
const getDb = vi.fn(() => ({ insert, select, delete: del }));
let dbConfigured = false;

vi.mock('@/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/db/client')>();
  return { ...actual, getDb, isDbConfigured: () => dbConfigured };
});

const { upsertClient, listClients, deleteClient, CLIENT_LIST_LIMIT } = await import('./clients');

const client = { name: 'ACME Hotel', addressLines: ['Street 1'], custId: '0020TBH', city: 'Jeddah', crNo: '4701' };

beforeEach(() => {
  dbConfigured = false;
  rows = [];
  values.mockClear();
  values.mockImplementation(() => ({ onConflictDoUpdate, returning }));
  onConflictDoUpdate.mockClear();
  returning.mockReset();
  returning.mockImplementation(resolveRows);
  insert.mockClear();
  select.mockClear();
  where.mockClear();
  orderBy.mockClear();
  limit.mockClear();
  del.mockClear();
  delWhere.mockClear();
  delReturning.mockReset();
  delReturning.mockImplementation(resolveRows);
});

describe('upsertClient (#11 slice 1)', () => {
  it('is a no-op returning null when the DB is unconfigured', async () => {
    expect(await upsertClient({ userId: 'u1', client })).toBeNull();
    expect(insert).not.toHaveBeenCalled();
  });

  it('trims the business key and upserts on (userId, name, custId)', async () => {
    dbConfigured = true;
    returning.mockResolvedValue([{ id: 'c1' }]);
    const id = await upsertClient({ userId: 'u1', client: { ...client, name: '  ACME Hotel  ', custId: '  0020TBH ' } });
    expect(id).toBe('c1');
    expect(values).toHaveBeenCalledWith({ userId: 'u1', name: 'ACME Hotel', custId: '0020TBH', data: { ...client, name: '  ACME Hotel  ', custId: '  0020TBH ' } });
    expect(onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ target: expect.any(Array) }),
    );
  });

  it('normalizes a blank custId to an empty string so it still joins the key', async () => {
    dbConfigured = true;
    returning.mockResolvedValue([{ id: 'c2' }]);
    await upsertClient({ userId: 'u1', client: { ...client, custId: '   ' } });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ name: 'ACME Hotel', custId: '' }));
  });

  it('rejects an empty/whitespace-only name (returns null, no write)', async () => {
    dbConfigured = true;
    expect(await upsertClient({ userId: 'u1', client: { ...client, name: '   ' } })).toBeNull();
    expect(insert).not.toHaveBeenCalled();
  });

  it('returns null (not throws) when the insert fails', async () => {
    dbConfigured = true;
    values.mockImplementation(() => {
      throw new Error('db down');
    });
    await expect(upsertClient({ userId: 'u1', client })).resolves.toBeNull();
  });
});

describe('listClients (#11 slice 1)', () => {
  it('returns [] when unconfigured', async () => {
    expect(await listClients('u1')).toEqual([]);
    expect(select).not.toHaveBeenCalled();
  });

  it('maps rows (freshest first) and defaults/caps the limit', async () => {
    dbConfigured = true;
    const d = new Date('2026-11-04T10:00:00.000Z');
    rows = [{ id: 'c1', name: 'ACME', custId: '1', data: client, updatedAt: d }];
    const out = await listClients('u1');
    expect(out).toEqual([{ id: 'c1', name: 'ACME', custId: '1', data: client, updatedAt: d.toISOString() }]);
    expect(limit).toHaveBeenCalledWith(CLIENT_LIST_LIMIT);

    limit.mockClear();
    await listClients('u1', 9999);
    expect(limit).toHaveBeenCalledWith(200); // hard cap

    limit.mockClear();
    await listClients('u1', 0);
    expect(limit).toHaveBeenCalledWith(1); // floor
  });
});

describe('deleteClient (#11 slice 1)', () => {
  it('is a no-op when unconfigured and true/false on the returned rows', async () => {
    expect(await deleteClient('u1', 'a-b-c')).toBe(false);
    dbConfigured = true;
    delReturning.mockResolvedValue([{ id: 'x' }]);
    expect(await deleteClient('u1', 'x')).toBe(true);
    delReturning.mockResolvedValue([]);
    expect(await deleteClient('u1', 'x')).toBe(false);
  });

  it('returns false rather than throwing on a db error (e.g. non-uuid id)', async () => {
    dbConfigured = true;
    delWhere.mockImplementation(() => {
      throw new Error('invalid input syntax for type uuid');
    });
    await expect(deleteClient('u1', 'not-a-uuid')).resolves.toBe(false);
  });
});
