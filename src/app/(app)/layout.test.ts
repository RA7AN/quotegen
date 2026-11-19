/**
 * #37 — the (app) layout's first-run gate.
 *
 * The layout is an async server component, so we drive it directly (no DOM): stub the session
 * + marker reads and record where `redirect` is told to send the visitor. This pins the exact
 * precedence the gate relies on — signed-out beats un-onboarded, and a completed account is
 * let through without any redirect.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getSessionUser = vi.fn();
const isSetupComplete = vi.fn();
const redirects: string[] = [];

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    redirects.push(url);
    throw { __redirect: url }; // Next signals a redirect by throwing
  },
}));
vi.mock('@/auth/session', () => ({ getSessionUser }));
vi.mock('@/db/profiles', () => ({ isSetupComplete }));
// Keep the client nav chrome out of a server-component unit test (#49: band menu + bottom bar).
vi.mock('./account-menu', () => ({ AccountMenu: () => null }));
vi.mock('./tab-bar', () => ({ TabBar: () => null }));

const AppLayout = (await import('./layout')).default;

beforeEach(() => {
  redirects.length = 0;
  getSessionUser.mockReset();
  isSetupComplete.mockReset();
});

describe('(app) layout first-run gate (#37)', () => {
  it('sends an anonymous visitor to /sign-in before checking setup', async () => {
    getSessionUser.mockResolvedValue(null);
    await expect(AppLayout({ children: null })).rejects.toBeTruthy();
    expect(redirects).toEqual(['/sign-in']);
    expect(isSetupComplete).not.toHaveBeenCalled();
  });

  it('bounces a signed-in, not-yet-onboarded account to /onboarding', async () => {
    getSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    isSetupComplete.mockResolvedValue(false);
    await expect(AppLayout({ children: null })).rejects.toBeTruthy();
    expect(redirects).toEqual(['/onboarding']);
    expect(isSetupComplete).toHaveBeenCalledWith('u1');
  });

  it('renders the shell once setup is complete (no redirect)', async () => {
    getSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    isSetupComplete.mockResolvedValue(true);
    await expect(AppLayout({ children: 'body' })).resolves.toBeTruthy();
    expect(redirects).toEqual([]);
  });
});
