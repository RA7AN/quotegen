// @vitest-environment jsdom
/**
 * #37 — DOM tests for the first-run onboarding wizard.
 *
 * Focus on the flow contract rather than re-testing the shared field sections (the Settings
 * suite already pins those labels): stepping forward, and — most importantly — that Finish and
 * Skip each fire exactly one server save carrying `completeSetup: true` (the marker that
 * releases the (app) gate) and then hand off into the app.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));

const saveProfileServer = vi.fn(async (..._a: unknown[]) => true);
const fetchProfile = vi.fn(async () => null);
vi.mock('@/wizard/library', () => ({
  saveProfileServer: (...a: unknown[]) => saveProfileServer(...a),
  fetchProfile: () => fetchProfile(),
}));

import { OnboardingView } from './onboarding-view';
import { KEYS } from '@/lib/storage';
import { DEFAULT_COMPANY_PROFILE } from '@/domain/defaults';

beforeEach(() => {
  localStorage.clear();
  push.mockClear();
  refresh.mockClear();
  saveProfileServer.mockClear();
  fetchProfile.mockClear();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

function getStarted() {
  fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
}

describe('OnboardingView stepper (#37)', () => {
  it('opens on the welcome step and walks forward to the identity fields', () => {
    render(<OnboardingView />);
    expect(screen.getByRole('heading', { name: /Set up your business/ })).toBeTruthy();
    expect(screen.queryByLabelText('Legal name (EN)')).toBeNull();
    getStarted();
    expect((screen.getByLabelText('Legal name (EN)') as HTMLInputElement).value).toBe(
      DEFAULT_COMPANY_PROFILE.legalNameEn,
    );
  });

  it('Back returns to the previous step', () => {
    render(<OnboardingView />);
    getStarted();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: /Set up your business/ })).toBeTruthy();
  });
});

describe('OnboardingView finish / skip (#37)', () => {
  it('Finish saves the edited profile to the server with the setup marker and routes home', async () => {
    render(<OnboardingView />);
    getStarted();
    fireEvent.change(screen.getByLabelText('Legal name (EN)'), { target: { value: 'Acme Trading Co' } });
    // Walk to the review step (identity → contact → signatory → review).
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: /Review & finish/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Finish setup' }));
    await waitFor(() => expect(saveProfileServer).toHaveBeenCalledTimes(1));
    expect(saveProfileServer).toHaveBeenCalledWith(
      expect.objectContaining({ legalNameEn: 'Acme Trading Co' }),
      { headerMark: null, footerMark: null },
      { completeSetup: true },
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith('/home'));
    expect(refresh).toHaveBeenCalled();
    // The device profile slot is written too (offline first-paint fallback).
    expect(JSON.parse(localStorage.getItem(KEYS.profile) as string).legalNameEn).toBe('Acme Trading Co');
  });

  it('Skip for now accepts the current (default) profile and still sets the marker', async () => {
    render(<OnboardingView />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    await waitFor(() => expect(saveProfileServer).toHaveBeenCalledTimes(1));
    expect(saveProfileServer).toHaveBeenCalledWith(
      expect.objectContaining({ legalNameEn: DEFAULT_COMPANY_PROFILE.legalNameEn }),
      expect.anything(),
      { completeSetup: true },
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith('/home'));
  });
});

describe('OnboardingView brand marks (#37)', () => {
  it('rejects an unsupported image inline without leaving the step', () => {
    render(<OnboardingView />);
    getStarted();
    fireEvent.click(screen.getByRole('button', { name: 'Next' })); // → contact
    fireEvent.click(screen.getByRole('button', { name: 'Next' })); // → signatory & brand marks
    fireEvent.change(screen.getByLabelText('Header logo'), {
      target: { files: [new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' })] },
    });
    expect(screen.getByRole('alert').textContent).toMatch(/PNG, JPEG, GIF or WebP/);
    expect(saveProfileServer).not.toHaveBeenCalled();
  });
});
