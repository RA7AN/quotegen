import { beforeEach, describe, expect, it, vi } from 'vitest';

// Auth and data seams mocked to pin the HTTP contract: 401 when signed out,
// per-user scoping, and the zeroed shape when the DB is unconfigured (the
// activities helpers already encapsulate that degradation, so the mock returns
// the empty fold the real helper would).
const requireSessionUser = vi.fn();
vi.mock('@/auth/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/auth/session')>();
  return { ...actual, requireSessionUser };
});

const eventCounts = vi.fn();
const deriveKpis = vi.fn();
vi.mock('@/db/activities', () => ({ eventCounts, deriveKpis }));

const { GET } = await import('./route');
const { UnauthorizedError } = await import('@/auth/session');

const EMPTY = { byType: {}, exportsByDocKind: {}, total: 0 };
const ZERO_KPIS = { quotationsGenerated: 0, proformasGenerated: 0, draftsSaved: 0 };

beforeEach(() => {
  requireSessionUser.mockReset();
  eventCounts.mockReset();
  deriveKpis.mockReset();
});

describe('GET /api/events/summary (#10 slice 1)', () => {
  it('is force-dynamic (session-scoped reads are never prerendered)', async () => {
    expect((await import('./route')).dynamic).toBe('force-dynamic');
  });

  it('returns 401 when signed out', async () => {
    requireSessionUser.mockRejectedValue(new UnauthorizedError());
    const res = await GET(new Request('http://localhost/api/events/summary'));
    expect(res.status).toBe(401);
    expect(eventCounts).not.toHaveBeenCalled();
  });

  it('returns counts + kpis scoped to the session user', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    eventCounts.mockResolvedValue(EMPTY);
    deriveKpis.mockReturnValue(ZERO_KPIS);

    const res = await GET(new Request('http://localhost/api/events/summary'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ counts: EMPTY, kpis: ZERO_KPIS });
    expect(eventCounts).toHaveBeenCalledWith('u1');
  });

  it('answers zeroes (not an error) when the DB is unconfigured', async () => {
    requireSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    eventCounts.mockResolvedValue(EMPTY);
    deriveKpis.mockReturnValue(ZERO_KPIS);

    const res = await GET(new Request('http://localhost/api/events/summary'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      counts: { byType: {}, exportsByDocKind: {}, total: 0 },
      kpis: { quotationsGenerated: 0, proformasGenerated: 0, draftsSaved: 0 },
    });
  });
});
