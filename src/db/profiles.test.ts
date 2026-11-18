import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_COMPANY_PROFILE } from '@/domain/defaults';

// Mock the drizzle client behind explicit chainable builders: these tests pin profiles.ts's
// own contract (creds guard, single-active-row targeting, validation, best-effort semantics),
// not drizzle. Each statement kind resolves to the row set its real driver yields:
//   select:  .from(..).where(..).orderBy(..).limit(..) → selectRows
//   insert:  .values(row).returning(..)                → selectRows
//   update:  .update(table).set(..).where(..)          → (un-awaited demotes)
//            [...].where(..).returning(..)             → updateRows
//   delete:  .delete(table).where(..)                  → []   (deleteProfile also re-selects)
// A test forces a DB error by making `from` throw synchronously, which the helper try/catch
// turns into []/null/false.
let selectRows: unknown[] = [];
let updateRows: unknown[] = [];
const limitSelect = vi.fn(() => Promise.resolve(selectRows));
// Select chains terminate at EITHER .limit(1) (getActiveProfile / getProfileById / exists-check)
// OR straight at .orderBy(..) (listProfiles / deleteProfile survivor), so orderBy must be both
// thenable (resolves the row set) AND expose .limit — awaiting an un-awaited builder is harmless.
const thenSelect = (fn?: (v: unknown) => unknown) => (fn ? fn(selectRows) : Promise.resolve(selectRows));
const orderBySelect = vi.fn(() => ({ limit: limitSelect, then: thenSelect }));
const whereSelect = vi.fn(() => ({ orderBy: orderBySelect, limit: limitSelect, then: thenSelect }));
const from = vi.fn(() => ({ where: whereSelect }));
const select = vi.fn(() => ({ from }));
const returningSelect = vi.fn(() => Promise.resolve(selectRows));
const values = vi.fn(() => ({ returning: returningSelect }));
const insert = vi.fn(() => ({ values }));
const returningUpdate = vi.fn(() => Promise.resolve(updateRows));
const whereUpdate = vi.fn(() => ({ returning: returningUpdate }));
const setUpdate = vi.fn((_set: unknown) => ({ where: whereUpdate }));
const update = vi.fn(() => ({ set: setUpdate }));
const limitDelete = vi.fn(() => Promise.resolve(selectRows));
const orderByDelete = vi.fn(() => ({ limit: limitDelete }));
const whereDelete = vi.fn(() => ({ then: (fn?: (v: unknown) => unknown) => fn?.([]), orderBy: orderByDelete, limit: limitDelete }));
const del = vi.fn(() => ({ where: whereDelete }));
const getDb = vi.fn(() => ({ insert, select, update, delete: del }));
let dbConfigured = false;

vi.mock('@/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/db/client')>();
  return { ...actual, getDb, isDbConfigured: () => dbConfigured };
});

const {
  getActiveProfile,
  upsertActiveProfile,
  isSetupComplete,
  listProfiles,
  getProfileById,
  createProfile,
  updateProfile,
  setActiveProfile,
  deleteProfile,
} = await import('./profiles');

const profile = { ...DEFAULT_COMPANY_PROFILE, legalNameEn: 'ACME Trading Co.' };

beforeEach(() => {
  dbConfigured = false;
  selectRows = [];
  updateRows = [];
  select.mockClear();
  from.mockClear();
  from.mockImplementation(() => ({ where: whereSelect }));
  whereSelect.mockClear();
  orderBySelect.mockClear();
  limitSelect.mockClear();
  limitSelect.mockImplementation(() => Promise.resolve(selectRows));
  insert.mockClear();
  values.mockClear();
  values.mockImplementation(() => ({ returning: returningSelect }));
  returningSelect.mockClear();
  returningSelect.mockImplementation(() => Promise.resolve(selectRows));
  update.mockClear();
  setUpdate.mockClear();
  setUpdate.mockImplementation(() => ({ where: whereUpdate }));
  whereUpdate.mockClear();
  whereUpdate.mockImplementation(() => ({ returning: returningUpdate }));
  returningUpdate.mockClear();
  returningUpdate.mockImplementation(() => Promise.resolve(updateRows));
  del.mockClear();
  whereDelete.mockClear();
  limitDelete.mockClear();
  limitDelete.mockImplementation(() => Promise.resolve(selectRows));
});

describe('getActiveProfile (#38)', () => {
  it('returns null without touching the DB when creds are absent', async () => {
    expect(await getActiveProfile('u1')).toBeNull();
    expect(select).not.toHaveBeenCalled();
  });

  it('returns null when there is no active row', async () => {
    dbConfigured = true;
    selectRows = [];
    expect(await getActiveProfile('u1')).toBeNull();
  });

  it('maps the active row (marks + marker + ISO updatedAt) when the payload validates', async () => {
    dbConfigured = true;
    const d = new Date('2026-11-04T10:00:00.000Z');
    selectRows = [{ payload: profile, headerMark: 'data:image/png;base64,AA==', footerMark: null, setupComplete: true, updatedAt: d }];
    expect(await getActiveProfile('u1')).toEqual({
      profile,
      headerMark: 'data:image/png;base64,AA==',
      footerMark: null,
      setupComplete: true,
      updatedAt: d.toISOString(),
    });
    expect(limitSelect).toHaveBeenCalledWith(1);
  });

  it('degrades to null when the stored payload no longer validates (corrupt row)', async () => {
    dbConfigured = true;
    selectRows = [{ payload: { nope: true }, headerMark: null, footerMark: null, updatedAt: new Date() }];
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
    selectRows = [{ id: 'p1' }];
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
    selectRows = []; // no existing default → insert path
    returningSelect.mockImplementationOnce(() => Promise.resolve([{ id: 'p2' }]));
    const id = await upsertActiveProfile({ userId: 'u1', profile, headerMark: 'data:image/png;base64,AA==', footerMark: null });
    expect(id).toBe('p2');
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', isDefault: true, headerMark: 'data:image/png;base64,AA==', footerMark: null }),
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('returns null (not throws) when the write fails', async () => {
    dbConfigured = true;
    selectRows = [];
    values.mockImplementation(() => {
      throw new Error('db down');
    });
    await expect(upsertActiveProfile({ userId: 'u1', profile, headerMark: null, footerMark: null })).resolves.toBeNull();
  });

  it('writes setupComplete only when provided (insert + update), so saves keep the marker', async () => {
    dbConfigured = true;
    selectRows = [{ id: 'p3' }]; // existing → update path, marker forwarded
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
    selectRows = [{ setupComplete: true }];
    expect(await isSetupComplete('u1')).toBe(true);
  });

  it('false when the active row exists but setup is not complete', async () => {
    dbConfigured = true;
    selectRows = [{ setupComplete: false }];
    expect(await isSetupComplete('u1')).toBe(false);
  });

  it('false when the account has no profile row yet (brand-new → prompt onboarding)', async () => {
    dbConfigured = true;
    selectRows = [];
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

// ---------------------------------------------------------------------------
// Multi-profile library helpers (#31 part 1)
// ---------------------------------------------------------------------------

const fullRow = {
  id: 'p1',
  name: 'Main Co',
  isDefault: true,
  payload: profile,
  headerMark: 'data:image/png;base64,AA==',
  footerMark: null,
  setupComplete: true,
  updatedAt: new Date('2026-11-04T10:00:00.000Z'),
};

describe('listProfiles (#31)', () => {
  it('returns [] without touching the DB when creds are absent', async () => {
    expect(await listProfiles('u1')).toEqual([]);
    expect(select).not.toHaveBeenCalled();
  });

  it('maps summary rows (id / name / isDefault / ISO updatedAt) and de-faults nulls', async () => {
    dbConfigured = true;
    selectRows = [
      { id: 'p1', name: 'Main Co', isDefault: true, updatedAt: new Date('2026-11-04T10:00:00.000Z') },
      { id: 'p2', name: 'Branch', isDefault: null, updatedAt: '2026-11-03T09:00:00.000Z' },
    ];
    expect(await listProfiles('u1')).toEqual([
      { id: 'p1', name: 'Main Co', isDefault: true, updatedAt: '2026-11-04T10:00:00.000Z' },
      { id: 'p2', name: 'Branch', isDefault: false, updatedAt: '2026-11-03T09:00:00.000Z' },
    ]);
  });

  it('degrades to [] rather than throwing on a DB error', async () => {
    dbConfigured = true;
    from.mockImplementation(() => {
      throw new Error('db down');
    });
    await expect(listProfiles('u1')).resolves.toEqual([]);
  });
});

describe('getProfileById (#31)', () => {
  it('returns null when creds are absent', async () => {
    expect(await getProfileById('u1', 'p1')).toBeNull();
    expect(select).not.toHaveBeenCalled();
  });

  it('returns null when no row matches (missing / foreign)', async () => {
    dbConfigured = true;
    selectRows = [];
    expect(await getProfileById('u1', 'p1')).toBeNull();
  });

  it('maps the full record when the payload validates', async () => {
    dbConfigured = true;
    selectRows = [fullRow];
    expect(await getProfileById('u1', 'p1')).toEqual({
      id: 'p1',
      name: 'Main Co',
      isDefault: true,
      profile,
      headerMark: 'data:image/png;base64,AA==',
      footerMark: null,
      setupComplete: true,
      updatedAt: '2026-11-04T10:00:00.000Z',
    });
  });

  it('degrades to null on a corrupt payload (EC-11 parity)', async () => {
    dbConfigured = true;
    selectRows = [{ ...fullRow, payload: { nope: true } }];
    expect(await getProfileById('u1', 'p1')).toBeNull();
  });
});

describe('createProfile (#31)', () => {
  it('returns null without writing when creds are absent', async () => {
    const id = await createProfile({ userId: 'u1', name: 'X', profile, headerMark: null, footerMark: null });
    expect(id).toBeNull();
    expect(insert).not.toHaveBeenCalled();
  });

  it('auto-defaults the first-ever profile (no demote update) and inserts isDefault', async () => {
    dbConfigured = true;
    selectRows = []; // exists-check finds nothing → asDefault true, no existing to clear
    returningSelect.mockImplementationOnce(() => Promise.resolve([{ id: 'new1' }]));
    const id = await createProfile({ userId: 'u1', name: 'First', profile, headerMark: 'data:image/png;base64,AA==', footerMark: null });
    expect(id).toBe('new1');
    expect(update).not.toHaveBeenCalled();
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', name: 'First', isDefault: true }));
  });

  it('demotes the current default first when makeDefault is true and a row exists', async () => {
    dbConfigured = true;
    selectRows = [{ id: 'existing' }]; // exists-check hits a row
    const id = await createProfile({ userId: 'u1', name: 'Second', profile, headerMark: null, footerMark: null, makeDefault: true });
    expect(update).toHaveBeenCalled(); // the clear-others demote statement
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ name: 'Second', isDefault: true }));
    expect(id).toBeTruthy();
  });

  it('keeps isDefault false when a row exists and makeDefault is omitted', async () => {
    dbConfigured = true;
    selectRows = [{ id: 'existing' }];
    await createProfile({ userId: 'u1', name: 'Extra', profile, headerMark: null, footerMark: null });
    expect(update).not.toHaveBeenCalled(); // not defaulting → no demote
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ name: 'Extra', isDefault: false }));
  });

  it('returns null (not throws) on a write error', async () => {
    dbConfigured = true;
    from.mockImplementation(() => {
      throw new Error('db down');
    });
    await expect(
      createProfile({ userId: 'u1', name: 'X', profile, headerMark: null, footerMark: null }),
    ).resolves.toBeNull();
  });
});

describe('updateProfile (#31)', () => {
  it('returns false without touching the DB when creds are absent', async () => {
    expect(await updateProfile('u1', 'p1', { name: 'Z' })).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('always sets updatedAt and forwards only present keys', async () => {
    dbConfigured = true;
    updateRows = [{ id: 'p1' }];
    const ok = await updateProfile('u1', 'p1', { name: 'Renamed' });
    expect(ok).toBe(true);
    const set = setUpdate.mock.calls[0]![0] as Record<string, unknown>;
    expect(set).toEqual({ updatedAt: expect.any(Date), name: 'Renamed' });
  });

  it('overwrites marks only when the key is present (rename leaves marks out)', async () => {
    dbConfigured = true;
    updateRows = [{ id: 'p1' }];
    await updateProfile('u1', 'p1', { profile, headerMark: null });
    const set = setUpdate.mock.calls[0]![0] as Record<string, unknown>;
    expect(set).toHaveProperty('payload', profile);
    expect(set).toHaveProperty('headerMark', null);
    expect(set).not.toHaveProperty('footerMark');
  });

  it('returns false when no row matches', async () => {
    dbConfigured = true;
    updateRows = [];
    expect(await updateProfile('u1', 'missing', { name: 'Z' })).toBe(false);
  });
});

describe('setActiveProfile (#31)', () => {
  it('returns false when creds are absent', async () => {
    expect(await setActiveProfile('u1', 'p1')).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('issues a demote-then-promote pair and returns whether the target matched', async () => {
    dbConfigured = true;
    updateRows = [{ id: 'p1' }];
    expect(await setActiveProfile('u1', 'p1')).toBe(true);
    expect(update).toHaveBeenCalledTimes(2); // clear old default, then set this one
  });

  it('returns false when the target row does not match', async () => {
    dbConfigured = true;
    updateRows = [];
    expect(await setActiveProfile('u1', 'nope')).toBe(false);
  });
});

describe('deleteProfile (#31)', () => {
  it('returns false when creds are absent', async () => {
    expect(await deleteProfile('u1', 'p1')).toBe(false);
    expect(del).not.toHaveBeenCalled();
  });

  it('returns false (no delete) when the target row is absent', async () => {
    dbConfigured = true;
    selectRows = [];
    expect(await deleteProfile('u1', 'p1')).toBe(false);
    expect(del).not.toHaveBeenCalled();
  });

  it('deletes a non-default row without promoting anyone', async () => {
    dbConfigured = true;
    selectRows = [{ isDefault: false }];
    expect(await deleteProfile('u1', 'p1')).toBe(true);
    expect(del).toHaveBeenCalled();
    // exactly one update() would be a promote; here there is none (row was not default)
    expect(update).not.toHaveBeenCalled();
  });

  it('promotes the most-recent survivor when deleting the default', async () => {
    dbConfigured = true;
    // row read → isDefault true; survivor read → a remaining row to promote
    selectRows = [{ isDefault: true }];
    limitDelete.mockImplementationOnce(() => Promise.resolve([{ id: 'p2' }])); // survivor lookup
    expect(await deleteProfile('u1', 'p1')).toBe(true);
    expect(update).toHaveBeenCalled();
  });
});
