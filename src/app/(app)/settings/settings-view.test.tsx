// @vitest-environment jsdom
/**
 * #3 — DOM tests for the company-profile editor body (FR-5.1 / FR-5.2).
 *
 * SettingsView is the only writable seam into profile storage, so this exercises
 * the two flows that matter: Save persists the edited profile to localStorage,
 * and Reset restores the seeded factory profile. Both are asserted against the
 * raw storage slot (not component state) because the render path reads from
 * there on the next document.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SettingsView } from './settings-view';
import { KEYS } from '@/lib/storage';
import { DEFAULT_COMPANY_PROFILE } from '@/domain/defaults';
import type { CompanyProfile } from '@/domain/types';

function storedProfile(): CompanyProfile | null {
  const raw = localStorage.getItem(KEYS.profile);
  return raw ? (JSON.parse(raw) as CompanyProfile) : null;
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('SettingsView save / reset (FR-5)', () => {
  it('starts from the seeded factory profile when nothing is stored', () => {
    render(<SettingsView />);
    expect((screen.getByLabelText('Legal name (EN)') as HTMLInputElement).value).toBe(
      DEFAULT_COMPANY_PROFILE.legalNameEn,
    );
  });

  it('Save writes the edited field to profile storage', () => {
    render(<SettingsView />);
    fireEvent.change(screen.getByLabelText('Legal name (EN)'), { target: { value: 'Acme Trading Co' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(storedProfile()?.legalNameEn).toBe('Acme Trading Co');
    // The status is announced in two live regions (sr-only + visible toast),
    // so assert presence rather than a unique match.
    expect(screen.getAllByText(/Profile saved/).length).toBeGreaterThan(0);
  });

  it('persists a nested signatory edit alongside the top-level fields', () => {
    render(<SettingsView />);
    fireEvent.change(screen.getByLabelText(/Bank name/), { target: { value: 'Al Rajhi' } });
    fireEvent.change(screen.getByLabelText(/^Name$/), { target: { value: 'Jane Doe' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const p = storedProfile();
    expect(p?.bankName).toBe('Al Rajhi');
    expect(p?.signatory.name).toBe('Jane Doe');
  });

  it('Reset restores the factory profile to storage and the form', () => {
    render(<SettingsView />);
    fireEvent.change(screen.getByLabelText('Legal name (EN)'), { target: { value: 'Temporary' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(storedProfile()?.legalNameEn).toBe('Temporary');

    fireEvent.click(screen.getByRole('button', { name: 'Reset to factory defaults' }));
    expect(storedProfile()?.legalNameEn).toBe(DEFAULT_COMPANY_PROFILE.legalNameEn);
    expect((screen.getByLabelText('Legal name (EN)') as HTMLInputElement).value).toBe(
      DEFAULT_COMPANY_PROFILE.legalNameEn,
    );
  });
});
