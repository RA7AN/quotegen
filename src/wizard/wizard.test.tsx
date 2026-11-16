// @vitest-environment jsdom
/**
 * #3 — DOM tests for the wizard shell: step chips, forward gating, and the
 * draft-resume banner (AC-7/AC-8/AC-12, EC-11).
 *
 * These are the behaviors the pure `state.test.ts` suite proves as functions but
 * never as chrome: `aria-current="step"` on the live chip, forward chips disabled
 * while an earlier step is incomplete, validation errors revealed only after an
 * attempted Continue, and the restore-vs-discard banner for a found draft (and
 * the graceful degrade for a corrupt one).
 *
 * The render/export and network seams (@react-pdf build, telemetry, the reuse
 * library) are mocked at the module boundary, so this exercises the shell's
 * navigation state machine — offline and deterministic.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const search = vi.hoisted(() => ({ current: new URLSearchParams() }));

vi.mock('@/pdf/theme', () => ({ registerFonts: vi.fn() }));
vi.mock('@/pdf/index', () => ({
  buildElement: vi.fn(),
  makeInput: vi.fn(() => ({})),
  filenameFor: vi.fn(() => 'X.pdf'),
  renderToBlob: vi.fn(async () => ({ blob: new Blob(), filename: 'X.pdf' })),
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => search.current }));
vi.mock('./telemetry', () => ({ logActivity: vi.fn(async () => {}) }));
vi.mock('./library', () => ({
  fetchClients: vi.fn(async () => []),
  fetchSignoffs: vi.fn(async () => []),
  saveClient: vi.fn(async () => false),
  removeClient: vi.fn(async () => false),
  saveSignoff: vi.fn(async () => false),
  removeSignoff: vi.fn(async () => false),
  fetchNextSeq: vi.fn(async () => null),
  fetchDraft: vi.fn(async () => null),
  fetchDrafts: vi.fn(async () => []),
  persistDraft: vi.fn(async () => null),
  removeDraft: vi.fn(async () => false),
}));

import { Wizard } from './wizard';
import { KEYS, encodeDraft } from '@/lib/storage';
import { createBlankQuoteDocument } from '@/domain/defaults';
import type { QuoteDocument } from '@/domain/types';

// readDraft validates through QuoteDocumentSchema, which requires a non-empty
// docNo, yyyy-mm-dd dates and a client name — so a "found draft" must be seeded
// with a schema-valid doc (a truly blank wizard is never autosaved by design).
function validDraftDoc(): QuoteDocument {
  const doc = createBlankQuoteDocument('quotation');
  return {
    ...doc,
    meta: { ...doc.meta, docNo: 'ENCM-26-1234', quoteDateISO: '2026-11-01', validUntilISO: '2026-12-01' },
    client: { ...doc.client, name: 'Red Sea Coastal Village Hotel' },
  };
}

beforeEach(() => {
  localStorage.clear();
  search.current = new URLSearchParams();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('Wizard step chips + gating (AC-7/AC-8)', () => {
  it('marks the active step with aria-current and disables unreachable forward chips', () => {
    render(<Wizard />);
    const chip1 = screen.getByRole('button', { name: '1. Meta & client' });
    const chip4 = screen.getByRole('button', { name: '4. Review & export' });
    expect(chip1.getAttribute('aria-current')).toBe('step');
    // A blank Step 1 is incomplete, so furthestAllowedStep is 1 → chips 2..4 locked.
    expect((chip4 as HTMLButtonElement).disabled).toBe(true);
  });

  it('reveals Step-1 validation errors only after an attempted Continue, and stays put', () => {
    render(<Wizard />);
    // Not attempted yet → no field errors shown.
    expect(screen.queryByText('Client name is required.')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));

    // Gated forward: still on step 1, now with the inline error surfaced.
    expect(screen.getByRole('button', { name: '1. Meta & client' }).getAttribute('aria-current')).toBe('step');
    expect(screen.getByText('Client name is required.')).toBeTruthy();
  });
});

describe('Wizard resume banner (AC-12 / EC-11)', () => {
  it('offers Resume/Start fresh for a readable draft and dismisses on Resume', () => {
    localStorage.setItem(KEYS.draft, encodeDraft(2, validDraftDoc()));
    render(<Wizard />);
    expect(screen.getByText(/Resume draft\?/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(screen.queryByText(/Resume draft\?/)).toBeNull();
  });

  it('discards a found draft on Start fresh without a native confirm', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    localStorage.setItem(KEYS.draft, encodeDraft(1, validDraftDoc()));
    render(<Wizard />);
    fireEvent.click(screen.getByRole('button', { name: 'Start fresh' }));
    expect(screen.queryByText(/Resume draft\?/)).toBeNull();
    expect(localStorage.getItem(KEYS.draft)).toBeNull();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('degrades to a corrupt-draft notice (never a white screen) for unreadable data', () => {
    localStorage.setItem(KEYS.draft, '{not json');
    render(<Wizard />);
    expect(screen.getByText(/could not be read/)).toBeTruthy();
    // The wizard chrome is still mounted and usable behind the notice.
    expect(screen.getByRole('button', { name: '1. Meta & client' })).toBeTruthy();
  });
});
