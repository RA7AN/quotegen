// @vitest-environment jsdom
/**
 * #31 part 1 — Settings profile-LIBRARY manager DOM tests.
 *
 * A dedicated file (the sibling settings-view.test.tsx deliberately leaves @/wizard/library
 * unmocked to prove the anonymous degradation path). Here the library seam IS mocked so we
 * can drive the multi-profile flows: the editor binds to the default row on mount (so Save
 * PATCHes that row instead of the singular PUT), and the manager lists / saves-as / promotes /
 * deletes rows. Storage slots are asserted directly because that is what the render path reads.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';

const library = vi.hoisted(() => ({
  fetchProfile: vi.fn(),
  saveProfileServer: vi.fn(),
  fetchProfiles: vi.fn(),
  fetchProfileById: vi.fn(),
  createProfileServer: vi.fn(),
  updateProfileServer: vi.fn(),
  deleteProfileServer: vi.fn(),
}));
vi.mock('@/wizard/library', () => library);

import { SettingsView } from './settings-view';
import { KEYS } from '@/lib/storage';
import { DEFAULT_COMPANY_PROFILE } from '@/domain/defaults';
import type { CompanyProfile } from '@/domain/types';

const defaultRow = { id: 'pd', name: 'Main Co', isDefault: true, updatedAt: '2026-11-04T10:00:00.000Z' };
const otherRow = { id: 'po', name: 'Branch X', isDefault: false, updatedAt: '2026-11-03T09:00:00.000Z' };

function storedProfile(): CompanyProfile | null {
  const raw = localStorage.getItem(KEYS.profile);
  return raw ? (JSON.parse(raw) as CompanyProfile) : null;
}

beforeEach(() => {
  localStorage.clear();
  library.fetchProfile.mockResolvedValue({
    profile: DEFAULT_COMPANY_PROFILE,
    assets: { headerMark: null, footerMark: null },
    setupComplete: true,
  });
  library.saveProfileServer.mockResolvedValue(true);
  library.fetchProfiles.mockResolvedValue([defaultRow, otherRow]);
  library.fetchProfileById.mockResolvedValue({
    id: 'po',
    name: 'Branch X',
    isDefault: false,
    profile: { ...DEFAULT_COMPANY_PROFILE, legalNameEn: 'BRANCH X TRADING' },
    assets: { headerMark: null, footerMark: null },
    setupComplete: true,
  });
  library.createProfileServer.mockResolvedValue('pnew');
  library.updateProfileServer.mockResolvedValue(true);
  library.deleteProfileServer.mockResolvedValue(true);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

describe('SettingsView library binding (#31)', () => {
  it('binds the editor to the default row and PATCHes it on save (not the singular PUT)', async () => {
    render(<SettingsView />);
    // Wait for the mount effect to adopt the server profile + bind the default row.
    await waitFor(() => expect(library.fetchProfiles).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('Legal name (EN)'), { target: { value: 'Edited Main' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(library.updateProfileServer).toHaveBeenCalledWith('pd', expect.objectContaining({ profile: expect.objectContaining({ legalNameEn: 'Edited Main' }) }));
    expect(library.saveProfileServer).not.toHaveBeenCalled();
    expect(storedProfile()?.legalNameEn).toBe('Edited Main');
  });

  it('lists library rows with the default flagged and an editing marker on the bound row', async () => {
    render(<SettingsView />);
    expect(await screen.findByText('Branch X')).toBeTruthy();
    expect(screen.getByText('Main Co')).toBeTruthy();
    // The editor opened on the default row, so it is marked as being edited.
    expect(screen.getByText('Editing')).toBeTruthy();
  });

  it('save-as-new creates a row and rebinds the editor to it', async () => {
    render(<SettingsView />);
    await waitFor(() => expect(library.fetchProfiles).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('Profile name'), { target: { value: 'Third Co' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save a copy as new' }));
    await waitFor(() =>
      expect(library.createProfileServer).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Third Co' }),
      ),
    );
  });

  it('loads another row into the editor on Edit (switches the bound id)', async () => {
    render(<SettingsView />);
    await waitFor(() => expect(library.fetchProfiles).toHaveBeenCalled());
    const branchRow = screen.getByText('Branch X').closest('li')!;
    fireEvent.click(within(branchRow).getByRole('button', { name: 'Edit' })); // Branch X row
    await waitFor(() => expect(library.fetchProfileById).toHaveBeenCalledWith('po'));
    await waitFor(() => expect((screen.getByLabelText('Legal name (EN)') as HTMLInputElement).value).toBe('BRANCH X TRADING'));
    // Now saving PATCHes the newly bound row.
    library.updateProfileServer.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(library.updateProfileServer).toHaveBeenCalledWith('po', expect.anything());
  });

  it('promotes a row via Set as default', async () => {
    render(<SettingsView />);
    await waitFor(() => expect(library.fetchProfiles).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Set as default' }));
    expect(library.updateProfileServer).toHaveBeenCalledWith('po', { makeDefault: true });
  });

  it('deletes a row through the in-app confirm (no native dialog)', async () => {
    const alertSpy = vi.spyOn(window, 'confirm').mockImplementation(() => false);
    render(<SettingsView />);
    await waitFor(() => expect(library.fetchProfiles).toHaveBeenCalled());
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[1]!); // non-default row
    // The dialog opens; confirming calls the delete seam.
    const confirmBtn = await screen.findByRole('button', { name: 'Delete profile' });
    fireEvent.click(confirmBtn);
    await waitFor(() => expect(library.deleteProfileServer).toHaveBeenCalledWith('po'));
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
