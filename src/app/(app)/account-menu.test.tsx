// @vitest-environment jsdom
/**
 * #49 — the ☰ account panel has to stay on screen and stay tappable.
 *
 * The audit measured this panel at x = −107 → 133 in a 390 px viewport: 45 % of it was
 * unreachable, because it was `absolute right-0 w-60` under a nav band that had wrapped two
 * rows. Dismissal also hung on `mousedown`, which touch suppresses during scroll gestures and
 * double-tap-zoom. This file pins the touch dismissal path, the Escape and resize paths, and
 * that the panel's own rows are thumb-sized.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock('@/auth/client', () => ({ authClient: { signOut: vi.fn(async () => ({})) } }));

import { AccountMenu } from './account-menu';

function openMenu() {
  render(<AccountMenu email="ops@encompassgroupsa.com" />);
  const trigger = screen.getByRole('button', { name: 'Account menu' });
  fireEvent.click(trigger);
  return { trigger };
}

afterEach(() => cleanup());

describe('AccountMenu disclosure (#49)', () => {
  it('is a 44 px trigger that announces its state', () => {
    render(<AccountMenu email="a@b.c" />);
    const trigger = screen.getByRole('button', { name: 'Account menu' });
    expect(trigger.className).toContain('min-h-[2.75rem]');
    expect(trigger.className).toContain('min-w-[2.75rem]');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('shows the email, the theme row and sign-out as 44 px rows', () => {
    openMenu();
    const panel = screen.getByRole('group', { name: 'Account' });
    expect(screen.getByText('ops@encompassgroupsa.com').className).toContain('break-all');
    // Both controls live inside the panel (nothing leaked next to the ☰ button).
    const rows = Array.from(panel.querySelectorAll('button'));
    expect(rows.length).toBe(2);
    for (const label of ['Dark mode', 'Sign out']) {
      expect(screen.getByRole('button', { name: label }).className).toContain('min-h-[2.75rem]');
    }
  });

  it('closes on an outside pointer press (touch), on Escape and on a resize', () => {
    const { trigger } = openMenu();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('group', { name: 'Account' })).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('group', { name: 'Account' })).toBeNull();

    fireEvent.click(trigger);
    fireEvent(window, new Event('resize'));
    expect(screen.queryByRole('group', { name: 'Account' })).toBeNull();
  });

  it('stays open when the press lands inside the panel', () => {
    openMenu();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Sign out' }));
    expect(screen.getByRole('group', { name: 'Account' })).toBeTruthy();
  });

  it('clamps the panel to the viewport width', () => {
    openMenu();
    expect(screen.getByRole('group', { name: 'Account' }).className).toContain('max-w-[calc(100vw-2rem)]');
  });
});
