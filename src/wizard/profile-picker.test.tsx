// @vitest-environment jsdom
/**
 * #31 part 1 — DOM tests for the per-quote letterhead picker.
 *
 * ProfilePicker is purely presentational (the wizard owns fetch/apply/persist), so these
 * pin its render contract: it collapses to nothing when the account has no saved profiles
 * (a first-time / anonymous run shows no empty chrome), names the current source, marks the
 * in-use row, and only offers the "use account default instead" reset once the user has
 * deviated. Callbacks are asserted, not their async effects.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ProfilePicker } from './profile-picker';
import type { StoredProfileSummary } from './library';

const a: StoredProfileSummary = { id: 'pa', name: 'Main Co', isDefault: true, updatedAt: '2026-11-04T10:00:00.000Z' };
const b: StoredProfileSummary = { id: 'pb', name: 'Branch X', isDefault: false, updatedAt: '2026-11-03T09:00:00.000Z' };

afterEach(cleanup);

describe('ProfilePicker (#31 part 1)', () => {
  it('renders nothing when there are no saved profiles', () => {
    const { container } = render(<ProfilePicker profiles={[]} currentId={null} onUse={vi.fn()} onResetToDefault={vi.fn()} />);
    expect(container.textContent).toBe('');
  });

  it('shows the account default as the current source and one action per row', () => {
    render(<ProfilePicker profiles={[a, b]} currentId={null} onUse={vi.fn()} onResetToDefault={vi.fn()} />);
    expect(screen.getAllByText(/account default/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/saved/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Use for this quote' })).toHaveLength(2);
    // No reset offered while the default is already in use, and nothing is marked in use.
    expect(screen.queryByText('Use account default instead')).toBeNull();
    expect(screen.queryByText('In use')).toBeNull();
  });

  it('marks the in-use row and only offers "use" for the others', () => {
    render(<ProfilePicker profiles={[a, b]} currentId={b.id} onUse={vi.fn()} onResetToDefault={vi.fn()} />);
    expect(screen.getAllByText('In use')).toHaveLength(1);
    expect(screen.getAllByText(/Branch X/).length).toBeGreaterThan(0); // named as the current source
    expect(screen.getAllByRole('button', { name: 'Use for this quote' })).toHaveLength(1);
    expect(screen.getByText('Use account default instead')).toBeTruthy();
  });

  it('routes a "Use for this quote" click to the row id and the reset to onResetToDefault', () => {
    const onUse = vi.fn();
    const onResetToDefault = vi.fn();
    render(<ProfilePicker profiles={[a, b]} currentId={a.id} onUse={onUse} onResetToDefault={onResetToDefault} />);
    fireEvent.click(screen.getByRole('button', { name: 'Use for this quote' }));
    expect(onUse).toHaveBeenCalledWith('pb');
    fireEvent.click(screen.getByText('Use account default instead'));
    expect(onResetToDefault).toHaveBeenCalledTimes(1);
  });
});
