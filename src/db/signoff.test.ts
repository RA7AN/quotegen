import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the drizzle client behind a chainable builder: these tests pin signoff.ts's own
// contract (creds guard, content dedupe, blank rejection, best-effort semantics).
//   insert: .values(row).onConflictDoUpdate(..).returning(..)   (upsertSignoffBlock)
//   select: .from(..).where(..).orderBy(..).limit(..)           (listSignoffBlocks)
//   delete: .delete(table).where(..).returning(..)              (deleteSignoffBlock)
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

const { upsertSignoffBlock, listSignoffBlocks, deleteSignoffBlock, signoffContentKey, SIGNOFF_LIST_LIMIT } =
  await import('./signoff');

const block = { signoff: 'Best regards,', name: 'Mithun', org: 'ENCM', mobile: '0500', email: 'm@encm.sa', website: 'encm.sa' };

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

describe('signoffContentKey (#11 slice 2)', () => {
  it('is deterministic and order-independent across the six fields', () => {
    const a = signoffContentKey(block);
    const b = signoffContentKey({ ...block });
    expect(a).toBe(b);
    expect(signoffContentKey({ ...block, name: ' Mithun ' })).toBe(a); // trims
    expect(signoffContentKey({ ...block, email: 'other@x.com' })).not.toBe(a);
  });
});

describe('upsertSignoffBlock (#11 slice 2)', () => {
  it('is a no-op returning null when the DB is unconfigured', async () => {
    expect(await upsertSignoffBlock({ userId: 'u1', block })).toBeNull();
    expect(insert).not.toHaveBeenCalled();
  });

  it('stores a content key + name-derived label and upserts on (userId, contentKey)', async () => {
    dbConfigured = true;
    returning.mockResolvedValue([{ id: 'b1' }]);
    const id = await upsertSignoffBlock({ userId: 'u1', block });
    expect(id).toBe('b1');
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', label: 'Mithun', contentKey: signoffContentKey(block), data: block }),
    );
    expect(onConflictDoUpdate).toHaveBeenCalledWith(expect.objectContaining({ target: expect.any(Array) }));
  });

  it('rejects a block with neither name nor email (default/empty closing)', async () => {
    dbConfigured = true;
    const empty = { ...block, name: '  ', email: '' };
    expect(await upsertSignoffBlock({ userId: 'u1', block: empty })).toBeNull();
    expect(insert).not.toHaveBeenCalled();
  });

  it('still stores when only an email is present (label falls back to null)', async () => {
    dbConfigured = true;
    returning.mockResolvedValue([{ id: 'b2' }]);
    await upsertSignoffBlock({ userId: 'u1', block: { ...block, name: '' } });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ label: null }));
  });

  it('returns null (not throws) when the insert fails', async () => {
    dbConfigured = true;
    values.mockImplementation(() => {
      throw new Error('db down');
    });
    await expect(upsertSignoffBlock({ userId: 'u1', block })).resolves.toBeNull();
  });
});

describe('listSignoffBlocks (#11 slice 2)', () => {
  it('returns [] when unconfigured', async () => {
    expect(await listSignoffBlocks('u1')).toEqual([]);
    expect(select).not.toHaveBeenCalled();
  });

  it('maps rows (freshest first) and defaults/caps/floors the limit', async () => {
    dbConfigured = true;
    const d = new Date('2026-11-04T10:00:00.000Z');
    rows = [{ id: 'b1', label: 'Mithun', data: block, updatedAt: d }];
    const out = await listSignoffBlocks('u1');
    expect(out).toEqual([{ id: 'b1', label: 'Mithun', data: block, updatedAt: d.toISOString() }]);
    expect(limit).toHaveBeenCalledWith(SIGNOFF_LIST_LIMIT);
    await listSignoffBlocks('u1', 9999);
    expect(limit).toHaveBeenLastCalledWith(200);
    await listSignoffBlocks('u1', 0);
    expect(limit).toHaveBeenLastCalledWith(1);
  });
});

describe('deleteSignoffBlock (#11 slice 2)', () => {
  it('is a no-op when unconfigured and true/false on the returned rows', async () => {
    expect(await deleteSignoffBlock('u1', 'x')).toBe(false);
    dbConfigured = true;
    delReturning.mockResolvedValue([{ id: 'x' }]);
    expect(await deleteSignoffBlock('u1', 'x')).toBe(true);
    delReturning.mockResolvedValue([]);
    expect(await deleteSignoffBlock('u1', 'x')).toBe(false);
  });

  it('returns false rather than throwing on a db error (e.g. non-uuid id)', async () => {
    dbConfigured = true;
    delWhere.mockImplementation(() => {
      throw new Error('invalid input syntax for type uuid');
    });
    await expect(deleteSignoffBlock('u1', 'nope')).resolves.toBe(false);
  });
});
