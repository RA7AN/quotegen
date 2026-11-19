// @vitest-environment jsdom
/**
 * #49 — the confirm dialog's phone ergonomics and destructive-action safety.
 *
 * The audit measured this dialog's *geometry* as fine (358×152 at y 346, backdrop covering
 * the viewport) and its behaviour as not: 34 px buttons 8 px apart, initial focus landing on
 * "Delete", no height cap, and a page that kept scrolling behind `aria-modal="true"`. Those
 * are what this file pins, plus the sheet classes that can't be measured in jsdom.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { ConfirmDialog } from './confirm-dialog';

type Props = ComponentProps<typeof ConfirmDialog>;

function open(overrides: Partial<Props> = {}) {
  const props: Props = {
    open: true,
    title: 'Delete draft?',
    message: '“MOB-26-001 — Acme Trading” will be removed. This cannot be undone.',
    confirmLabel: 'Delete',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  const view = render(<ConfirmDialog {...props} />);
  return { props, ...view };
}

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
  document.body.style.overscrollBehavior = '';
});

describe('ConfirmDialog focus + safety (#49)', () => {
  it('focuses Cancel, never the destructive action', () => {
    open();
    expect(document.activeElement?.textContent).toBe('Cancel');
    expect(document.activeElement?.textContent).not.toBe('Delete');
  });

  it('closes on Escape and on a pointer press on the backdrop, but not inside the panel', () => {
    const { props, container } = open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onCancel).toHaveBeenCalledTimes(1);

    const backdrop = container.firstElementChild as HTMLElement;
    fireEvent.pointerDown(backdrop);
    expect(props.onCancel).toHaveBeenCalledTimes(2);

    fireEvent.pointerDown(screen.getByRole('alertdialog'));
    expect(props.onCancel).toHaveBeenCalledTimes(2);
  });

  it('confirms only when the confirm button is pressed', () => {
    const { props } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  it('traps Tab inside the panel', () => {
    open();
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const del = screen.getByRole('button', { name: 'Delete' });

    del.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(cancel);

    cancel.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(del);
  });
});

describe('ConfirmDialog background scroll lock (#49)', () => {
  it('locks the page while open and restores the previous inline styles on close', () => {
    document.body.style.overflow = 'visible';
    const { unmount } = open();
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.overscrollBehavior).toBe('contain');
    unmount();
    expect(document.body.style.overflow).toBe('visible');
    expect(document.body.style.overscrollBehavior).toBe('');
  });

  it('returns focus to the control that opened the dialog', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'row delete';
    document.body.appendChild(trigger);
    trigger.focus();
    const { unmount } = open();
    expect(document.activeElement).not.toBe(trigger);
    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});

describe('ConfirmDialog phone sheet layout (#49)', () => {
  it('is bottom-anchored, height-capped and internally scrollable', () => {
    const { container } = open({ message: 'Long message '.repeat(200) });
    const backdrop = container.firstElementChild as HTMLElement;
    const panel = screen.getByRole('alertdialog');
    // Sheet on phones, centred card from sm: up.
    expect(backdrop.className).toContain('items-end');
    expect(backdrop.className).toContain('sm:items-center');
    // A long message must scroll inside the sheet, never push the buttons off-screen.
    expect(panel.className).toContain('max-h-[80svh]');
    expect(panel.className).toContain('overflow-y-auto');
  });

  it('gives both actions a 44 px target with a 12 px gap', () => {
    open();
    for (const name of ['Cancel', 'Delete']) {
      expect(screen.getByRole('button', { name }).className).toContain('min-h-[2.75rem]');
    }
    expect(screen.getByRole('button', { name: 'Cancel' }).parentElement?.className).toContain('gap-3');
  });

  it('renders nothing when closed', () => {
    render(<ConfirmDialog open={false} title="t" message="m" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
