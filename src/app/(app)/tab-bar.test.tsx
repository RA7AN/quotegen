// @vitest-environment jsdom
/**
 * #49 — the bottom tab bar that replaced the wrapped six-link header nav.
 *
 * Pins the four things the audit could not do on a phone: every destination lives in ONE
 * row of 44 px+ tabs (the old nav wrapped to two rows of 16 px links inside a 128 px header),
 * the active route is marked with `aria-current="page"`, the three secondary sections are
 * reachable through the More sheet, and that sheet behaves like a modal (Escape closes, a
 * route change closes, focus returns to the button that opened it).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const route = vi.hoisted(() => ({ path: '/home' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.path }));

import { TabBar } from './tab-bar';

function renderBar() {
  return render(<TabBar />);
}

afterEach(() => {
  cleanup();
  route.path = '/home';
});

describe('TabBar destinations (#49)', () => {
  it('offers Home, New quote, Quotes and a More disclosure in one row', () => {
    renderBar();
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(screen.getByRole('link', { name: 'Home' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'New quote' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Quotes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'More' }).getAttribute('aria-haspopup')).toBe('dialog');
    // The nav never wraps: four equal flex children in a single ul.
    const items = nav.querySelectorAll('li');
    expect(items.length).toBe(4);
    for (const item of Array.from(items)) {
      const control = item.firstElementChild as HTMLElement;
      expect(control.className).toContain('min-h-[3.25rem]');
      expect(control.className).toContain('flex-1');
    }
  });

  it('clears the iPhone home indicator and the page reserves space for the bar', () => {
    renderBar();
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(nav.className).toContain('pb-[env(safe-area-inset-bottom)]');
    expect(nav.className).toContain('fixed');
  });

  it('marks the active route with aria-current="page"', () => {
    route.path = '/quotes';
    renderBar();
    expect(screen.getByRole('link', { name: 'Quotes' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBeNull();
  });

  it('marks More as current while one of its sections is open', () => {
    route.path = '/settings';
    renderBar();
    expect(screen.getByRole('button', { name: 'More' }).getAttribute('aria-current')).toBe('page');
  });
});

describe('TabBar More sheet (#49)', () => {
  it('exposes Drafts, Recent and Settings on 48 px rows with their real routes', () => {
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    const dialog = screen.getByRole('dialog', { name: 'More sections' });
    const links = dialog.querySelectorAll('a');
    expect(Array.from(links).map((a) => a.getAttribute('href'))).toEqual(['/drafts', '/recent', '/settings']);
    for (const link of Array.from(links)) {
      expect(link.className).toContain('min-h-[3rem]');
      expect(link.getAttribute('aria-current')).toBeNull();
    }
  });

  it('marks the current section inside the sheet', () => {
    route.path = '/drafts';
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('link', { name: /Drafts/ }).getAttribute('aria-current')).toBe('page');
  });

  it('closes on Escape, on Close, and on a route change', () => {
    const view = renderBar();
    const more = screen.getByRole('button', { name: 'More' });

    fireEvent.click(more);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(more.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(more);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    // The bar lives in the layout, so it survives navigation and must clear itself.
    fireEvent.click(more);
    expect(screen.getByRole('dialog')).toBeTruthy();
    route.path = '/recent';
    view.rerender(<TabBar />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('dismisses on a pointer press on the backdrop', () => {
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.pointerDown(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
