/**
 * wizard/share.test.ts — feature-detection and outcome mapping of the Web Share
 * Level 2 helpers. navigator is stubbed per test; nothing here touches the DOM.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { canSharePdf, sharePdfFile } from './share';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubNavigator(nav: Record<string, unknown>): void {
  vi.stubGlobal('navigator', nav);
}

describe('canSharePdf', () => {
  it('false when the platform exposes no share API', () => {
    stubNavigator({});
    expect(canSharePdf()).toBe(false);
  });

  it('false when only text sharing is advertised (desktop Chrome pattern)', () => {
    const canShare = vi.fn((_data: unknown) => false);
    stubNavigator({ canShare, share: vi.fn() });
    expect(canSharePdf()).toBe(false);
    // Probed with a real PDF File, not a bare { files: true } claim.
    const arg = canShare.mock.calls[0]?.[0] as { files?: File[] } | undefined;
    expect(arg?.files?.[0]?.type).toBe('application/pdf');
    expect(arg?.files?.[0]?.name).toBe('probe.pdf');
  });

  it('false when canShare throws on the payload shape', () => {
    stubNavigator({ canShare: vi.fn(() => { throw new TypeError('nope'); }), share: vi.fn() });
    expect(canSharePdf()).toBe(false);
  });

  it('true when canShare accepts a PDF file payload', () => {
    stubNavigator({ canShare: vi.fn(() => true), share: vi.fn() });
    expect(canSharePdf()).toBe(true);
  });
});

describe('sharePdfFile', () => {
  it('reports unsupported without calling share', async () => {
    const share = vi.fn();
    stubNavigator({ share });
    const res = await sharePdfFile(new Blob(['x']), 'q.pdf', 'Quotation 1');
    expect(res.outcome).toBe('unsupported');
    expect(share).not.toHaveBeenCalled();
  });

  it('shares the blob as a named PDF File with title and text', async () => {
    const share = vi.fn(async (_data: unknown) => undefined);
    stubNavigator({ canShare: () => true, share });
    const res = await sharePdfFile(new Blob(['%PDF-1.4']), 'ENCM-26.pdf', 'Quotation 6824', 'From ACME.');
    expect(res.outcome).toBe('shared');
    const data = share.mock.calls[0]?.[0] as { title?: string; text?: string; files?: File[] } | undefined;
    expect(data?.title).toBe('Quotation 6824');
    expect(data?.text).toBe('From ACME.');
    expect(data?.files?.[0]?.name).toBe('ENCM-26.pdf');
    expect(data?.files?.[0]?.type).toBe('application/pdf');
  });

  it('maps a dismissed sheet to cancelled, not failed', async () => {
    stubNavigator({
      canShare: () => true,
      share: async () => {
        throw new DOMException('user closed the sheet', 'AbortError');
      },
    });
    const res = await sharePdfFile(new Blob(['x']), 'q.pdf', 'T');
    expect(res.outcome).toBe('cancelled');
    expect(res.error).toBeUndefined();
  });

  it('maps any other rejection to failed with the message', async () => {
    stubNavigator({
      canShare: () => true,
      share: async () => {
        throw new Error('NotAllowed: no user gesture');
      },
    });
    const res = await sharePdfFile(new Blob(['x']), 'q.pdf', 'T');
    expect(res.outcome).toBe('failed');
    expect(res.error).toBe('NotAllowed: no user gesture');
  });
});
