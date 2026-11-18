import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_COMPANY_PROFILE } from '@/domain/defaults';

// Mock the drizzle client behind a chainable builder: these tests pin profiles.ts's own
// contract (creds guard, single-active-row targeting, validation, best-effort semantics),
// not drizzle.
//   select: .from(..).where(..).orderBy(..).limit(..)                (getActiveProfile / exists-check)
//   update: .update(table).set(..).where(..)                         (upsert refresh)
//   insert: .values(row).returning(..)                               (upsert create)
let rows: unknown[] = [];
const resolveRows = () => Promise.resolve(rows);
const limit = vi.fn(resolveRows);
const orderBy = vi.fn(() => ({ limit }));
const whereSelect = vi.fn(() => ({ orderBy }));
const from = vi.fn(() => ({ where: whereSelect }));
const select = vi.fn(() => ({ from }));
const returning = vi.fn(resolveRows);
const values = vi.fn(() => ({ returning }));
const insert = vi.fn(() => ({ values }));
const whereUpdate = vi.fn(resolveRows);
const setUpdate = vi.fn((_set: unknown) => ({ where: whereUpdate }));
const update = vi.fn(() => ({ set: setUpdate }));
const getDb = vi.fn(() => ({ insert, select, update }));
let dbConfigured = false;

vi.mock('@/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/db/client')>();
  return { ...actual, getDb, isDbConfigured: () => dbConfigured };
});

const { getActiveProfile, upsertActiveProfile, isSetupComplete } = await import('./profiles');

const profile = { ...DEFAULT_COMPANY_PROFILE, legalNameEn: 'ACME Trading Co.' };

beforeEach(() => {
  dbConfigured = false;
  rows = [];
  select.mockClear();
  from.mockClear();
  from.mockImplementation(() => ({ where: whereSelect }));
  whereSelect.mockClear();
  orderBy.mockClear();
  limit.mockClear();
  insert.mockClear();
  values.mockClear();
  values.mockImplementation(() => ({ returning }));
  returning.mockReset();
  returning.mockImplementation(resolveRows);
  update.mockClear();
  setUpdate.mockClear();
  setUpdate.mockImplementation(() => ({ where: whereUpdate }));
  whereUpdate.mockClear();
  whereUpdate.mockImplementation(resolveRows);
});

describe('getActiveProfile (#38)', () => {
  it('returns null without touching the DB when creds are absent', async () => {
    expect(await getActiveProfile('u1')).toBeNull();
    expect(select).not.toHaveBeenCalled();
  });

  it('returns null when there is no active row', async () => {
    dbConfigured = true;
    rows = [];
    expect(await getActiveProfile('u1')).toBeNull();
  });

  it('maps the active row (marks + marker + ISO updatedAt) when the payload validates', async () => {
    dbConfigured = true;
    const d = new Date('2026-11-04T10:00:00.000Z');
    rows = [{ payload: profile, headerMark: 'data:image/png;base64,AA==', footerMark: null, setupComplete: true, updatedAt: d }];
    expect(await getActiveProfile('u1')).toEqual({
      profile,
      headerMark: 'data:image/png;base64,AA==',
      footerMark: null,
      setupComplete: true,
      updatedAt: d.toISOString(),
    });
    expect(limit).toHaveBeenCalledWith(1);
  });

  it('degrades to null when the stored payload no longer validates (corrupt row)', async () => {
    dbConfigured = true;
    rows = [{ payload: { nope: true }, headerMark: null, footerMark: null, updatedAt: new Date() }];
    expect(await getActiveProfile('u1')).toBeNull();
  });

  it('returns null rather than throwing on a DB error', async () => {
    dbConfigured = true;
    from.mockImplementation(() => {
      throw new Error('db down');
    });
    await expect(getActiveProfile('u1')).resolves.toBeNull();
  });
});

describe('upsertActiveProfile (#38)', () => {
  it('is an accepted-noop returning null when creds are absent', async () => {
    const id = await upsertActiveProfile({ userId: 'u1', profile, headerMark: null, footerMark: null });
    expect(id).toBeNull();
    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('updates the existing default row in place (marks overwritten, incl. null)', async () => {
    dbConfigured = true;
    rows = [{ id: 'p1' }];
    const id = await upsertActiveProfile({ userId: 'u1', profile, headerMark: null, footerMark: 'data:image/png;base64,BB==' });
    expect(id).toBe('p1');
    expect(update).toHaveBeenCalled();
    expect(setUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ payload: profile, headerMark: null, footerMark: 'data:image/png;base64,BB==' }),
    );
    expect(insert).not.toHaveBeenCalled();
  });

  it('inserts a new isDefault row when none exists', async () => {
    dbConfigured = true;
    rows = [];
    returning.mockResolvedValue([{ id: 'p2' }]);
    const id = await upsertActiveProfile({ userId: 'u1', profile, headerMark: 'data:image/png;base64,AA==', footerMark: null });
    expect(id).toBe('p2');
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', isDefault: true, headerMark: 'data:image/png;base64,AA==', footerMark: null }),
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('returns null (not throws) when the write fails', async () => {
    dbConfigured = true;
    rows = [];
    values.mockImplementation(() => {
      throw new Error('db down');
    });
    await expect(upsertActiveProfile({ userId: 'u1', profile, headerMark: null, footerMark: null })).resolves.toBeNull();
  });

  it('writes setupComplete only when provided (insert + update), so saves keep the marker', async () => {
    dbConfigured = true;
    rows = []; // no existing → insert path
    returning.mockResolvedValue([{ id: 'p3' }]);
    await upsertActiveProfile({ userId: 'u1', profile, headerMark: null, footerMark: null, setupComplete: true });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ isDefault: true, setupComplete: true }));

    rows = [{ id: 'p1' }]; // existing → update path, marker forwarded
    await upsertActiveProfile({ userId: 'u1', profile, headerMark: null, footerMark: null, setupComplete: false });
    expect(setUpdate).toHaveBeenCalledWith(expect.objectContaining({ setupComplete: false }));

    // A plain save (no setupComplete) must NOT include the key in the update set.
    setUpdate.mockClear();
    await upsertActiveProfile({ userId: 'u1', profile, headerMark: null, footerMark: null });
    expect(setUpdate.mock.calls[0]![0]).not.toHaveProperty('setupComplete');
  });
});

describe('isSetupComplete (#37 onboarding gate)', () => {
  it('degrades open (true) when the DB is unconfigured', async () => {
    expect(await isSetupComplete('u1')).toBe(true);
    expect(select).not.toHaveBeenCalled();
  });

  it('true when the active row has setup_complete set', async () => {
    dbConfigured = true;
    rows = [{ setupComplete: true }];
    expect(await isSetupComplete('u1')).toBe(true);
  });

  it('false when the active row exists but setup is not complete', async () => {
    dbConfigured = true;
    rows = [{ setupComplete: false }];
    expect(await isSetupComplete('u1')).toBe(false);
  });

  it('false when the account has no profile row yet (brand-new → prompt onboarding)', async () => {
    dbConfigured = true;
    rows = [];
    expect(await isSetupComplete('u1')).toBe(false);
  });

  it('degrades open (true) rather than throwing on a DB error', async () => {
    dbConfigured = true;
    from.mockImplementation(() => {
      throw new Error('db down');
    });
    await expect(isSetupComplete('u1')).resolves.toBe(true);
  });
});
