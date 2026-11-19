// @vitest-environment jsdom
/**
 * #3 — DOM tests for the recent-documents surface (#12 slice 2, AC-9).
 *
 * Covers the list lifecycle the pure rerender tests can't: loading → empty vs.
 * rows, the 401 "sign in" degradation (never a native alert), on-demand re-render
 * for Download/Open, and the confirm-gated delete round-trip. The PDF renderer and
 * the rehydrate seam are mocked at the module boundary so the DOM logic is what
 * runs under test — deterministic and offline.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';

const { renderToBlob, rehydrateById } = vi.hoisted(() => ({
  renderToBlob: vi.fn(),
  rehydrateById: vi.fn(),
}));

vi.mock('@/pdf/theme', () => ({ registerFonts: vi.fn() }));
vi.mock('@/pdf/index', () => ({ renderToBlob }));
vi.mock('./rerender', () => ({ rehydrateById }));
// #38: the component fetches the account's server marks on mount; stub it to "anonymous /
// none" so the DOM test drives only the document list + re-render paths via its fetch stub.
vi.mock('@/wizard/library', () => ({ fetchProfile: vi.fn(async () => null) }));

import { RecentDocuments } from './recent-documents';

const ROW = { id: 'D1', kind: 'quotation', number: 'ENCM-26-6824', clientName: 'Red Sea Hotel', createdAt: '2026-11-01T00:00:00Z' };

/** fetch stub that answers by method + path; the DELETE path is recorded for assertions. */
function stubFetch(getResponse: { ok: boolean; status?: number; items?: unknown }) {
  const calls: Array<{ url: string; method: string }> = [];
  globalThis.fetch = vi.fn(async (url: string, init?: { method?: string }) => {
    const method = init?.method ?? 'GET';
    calls.push({ url: String(url), method });
    if (method === 'DELETE') return { ok: true, status: 200, json: async () => ({}) };
    return {
      ok: getResponse.ok,
      status: getResponse.status ?? 200,
      json: async () => ({ items: getResponse.items }),
    };
  }) as unknown as typeof fetch;
  return calls;
}

beforeEach(() => {
  renderToBlob.mockResolvedValue({ blob: new Blob(['%PDF-1.4']), filename: 'ENCM-26-6824.pdf' });
  rehydrateById.mockResolvedValue({ doc: {}, profile: {} });
  // jsdom has no object-URL support; stub the two calls the component makes.
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:rendered');
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
  window.open = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('RecentDocuments list lifecycle', () => {
  it('degrades to the "sign in" prompt on a 401, with no native alert (AC-9)', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    stubFetch({ ok: false, status: 401 });
    render(<RecentDocuments />);
    await waitFor(() => expect(screen.getByText(/Sign in to see your recent documents/)).toBeTruthy());
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('shows the empty state when the list is genuinely empty', async () => {
    stubFetch({ ok: true, items: [] });
    render(<RecentDocuments />);
    await waitFor(() =>
      expect(screen.getByText(/Nothing stored yet/)).toBeTruthy(),
    );
  });

  it('renders a row per stored document', async () => {
    stubFetch({ ok: true, items: [ROW] });
    render(<RecentDocuments />);
    // The row renders "number · client" as ONE text node, so exact matching needs
    // a substring matcher rather than the normalized-equality default.
    await waitFor(() => expect(screen.getByText(/ENCM-26-6824/)).toBeTruthy());
    expect(screen.getByText(/Red Sea Hotel/)).toBeTruthy();
  });
});

describe('RecentDocuments re-render flows', () => {
  it('Download rehydrates + renders + builds an object URL', async () => {
    stubFetch({ ok: true, items: [ROW] });
    render(<RecentDocuments />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    // #38: re-render now takes (id, fetch, server-marks); anonymous stub → null overrides.
    await waitFor(() => expect(rehydrateById).toHaveBeenCalledWith('D1', expect.anything(), null));
    expect(renderToBlob).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('Open re-renders and pops the blob URL in a new tab', async () => {
    stubFetch({ ok: true, items: [ROW] });
    render(<RecentDocuments />);
    // #49: the whole row is the Open control, so its accessible name is "Open <title>".
    await waitFor(() => expect(screen.getByRole('button', { name: /^Open / })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /^Open / }));
    await waitFor(() => expect(window.open).toHaveBeenCalledWith('blob:rendered', '_blank', 'noopener'));
  });
});

describe('RecentDocuments delete', () => {
  it('routes through the confirm dialog, then issues DELETE and reloads', async () => {
    stubFetch({ ok: true, items: [ROW] });
    render(<RecentDocuments />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove' })).toBeTruthy());

    // Row "Remove" opens the accessible dialog; the dialog has its own confirm button.
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));

    await waitFor(() =>
      expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.some(
        ([url, init]) => url === '/api/documents/D1' && init?.method === 'DELETE',
      )).toBe(true),
    );
  });

  it('cancelling the dialog issues no DELETE', async () => {
    const calls = stubFetch({ ok: true, items: [ROW] });
    render(<RecentDocuments />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
  });
});
