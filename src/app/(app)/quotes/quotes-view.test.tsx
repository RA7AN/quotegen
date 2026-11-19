// @vitest-environment jsdom
/**
 * #49 — the saved-quotes list: confirm-gated delete and a row that a thumb can aim at.
 *
 * Before this change Delete called `remove()` straight from a 63×26 button, so one stray tap
 * destroyed a saved snapshot (the only artefact carrying a document number) while drafts and
 * profiles both asked first. These tests pin the ask, the naming of the quote in the message,
 * and that cancelling leaves the record in storage.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { QuotesView } from './quotes-view';
import { browserKV, listQuotes, upsertQuote } from '@/lib/storage';
import { createBlankQuoteDocument } from '@/domain/defaults';

function seed(...names: string[]) {
  names.forEach((name, i) => {
    const doc = createBlankQuoteDocument('quotation');
    // The codec skips anything that fails validation: Meta.docNo and the two dates are
    // required (`yyyy-mm-dd`), as is Client.name, so a snapshot needs them to round-trip.
    doc.meta.docNo = `ENCM-26-68${20 + i}`;
    doc.meta.quoteDateISO = '2026-10-25';
    doc.meta.validUntilISO = '2026-11-24';
    doc.client = { name, addressLines: ['Jeddah'], custId: `0020${i}`, city: 'Jeddah', crNo: '4701102147' };
    doc.lines = [
      { id: `l${i}`, description: 'Worktop supply and install', uom: 'u', qtyHundredths: 100, unitPriceHalalas: 530000, pricing: 'rated' },
    ];
    upsertQuote(browserKV(), { id: `Q${i + 1}`, name, savedAtISO: '2026-11-01T00:00:00.000Z', doc });
  });
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
  push.mockClear();
});

describe('QuotesView delete is confirm-gated (#49)', () => {
  it('asks first, naming the quote, and keeps the record until confirmed', () => {
    seed('Red Sea Hotel — ENCM-26-6824');
    render(<QuotesView />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(listQuotes(browserKV()).length).toBe(1);

    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(/Red Sea Hotel — ENCM-26-6824/)).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(listQuotes(browserKV()).length).toBe(0);
  });

  it('cancelling keeps the snapshot', () => {
    seed('Madinah Tower — ENCM-26-6825');
    render(<QuotesView />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(listQuotes(browserKV()).map((q) => q.name)).toEqual(['Madinah Tower — ENCM-26-6825']);
  });

  it('no native confirm/alert anywhere on the path (AC-9)', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    seed('Jeddah Mall — ENCM-26-6826');
    render(<QuotesView />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });
});

describe('QuotesView row anatomy (#49)', () => {
  it('makes the whole title row the Open control and keeps Duplicate as a 44 px action', () => {
    seed('Yanbu Refinery — ENCM-26-6827');
    render(<QuotesView />);

    const open = screen.getByRole('button', { name: /^Open / });
    expect(open.className).toContain('min-h-[3rem]');
    fireEvent.click(open);
    expect(push).toHaveBeenCalledWith('/new');

    const duplicate = screen.getByRole('button', { name: 'Duplicate' });
    expect(duplicate.className).toContain('min-h-[2.75rem]');
    expect(screen.queryByRole('button', { name: 'Open' })).toBeNull();
  });

  it('shows the empty state when nothing is saved', () => {
    render(<QuotesView />);
    expect(screen.getByText(/Nothing saved yet/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });
});
