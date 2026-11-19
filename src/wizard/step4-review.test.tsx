// @vitest-environment jsdom
/**
 * Step-4 preview stability (viewer flicker regression).
 *
 * @react-pdf's `PDFViewer` re-renders the document whenever the identity of its
 * `children` changes: each new element means a fresh blob URL, an iframe `src`
 * swap and a full reload — the preview blanks and jumps back to page 1. Because
 * `buildElement` used to run inline in JSX, ANY unrelated wizard re-render (typing
 * in the export panel, a toast auto-dismissing) restarted the PDF the user was
 * reading, which is what looked like "blinking when I scroll".
 *
 * These tests pin the fix at the seam: the element handed to the viewer must be
 * stable while `input` is unchanged, and must refresh when `input` changes — so
 * the preview never reloads for a non-render reason, and never goes stale either.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { PdfInput } from '@/pdf/input';

// Records the identity of every element passed to the viewer, without rendering
// the real PDF (no canvas/blob machinery in jsdom).
const seen = vi.hoisted(() => ({ children: [] as unknown[] }));

vi.mock('@react-pdf/renderer', () => ({
  PDFViewer: ({ children }: { children: unknown }) => {
    seen.children.push(children);
    return <div data-testid="viewer" />;
  },
}));

const buildElement = vi.hoisted(() => vi.fn((input: unknown) => ({ marker: 'doc', input })));
vi.mock('@/pdf/index', () => ({ buildElement }));

import { Step4Review } from './step4-review';

const INPUT_A = { tag: 'a' } as unknown as PdfInput;
const INPUT_B = { tag: 'b' } as unknown as PdfInput;

function reviewProps(input: PdfInput, saveName = '') {
  return {
    input,
    onDownload: () => {},
    onPrint: () => {},
    onShare: () => {},
    sharing: false,
    nativeShare: false,
    onSaveQuote: () => {},
    saveName,
    setSaveName: () => {},
  };
}

beforeEach(() => {
  seen.children.length = 0;
  buildElement.mockClear();
});

describe('Step4 PDF preview — reload stability', () => {
  it('keeps one stable viewer element while the input is unchanged', () => {
    const { rerender } = render(<Step4Review {...reviewProps(INPUT_A, '')} />);
    // Re-render the step the way the wizard does on an unrelated state change:
    // same input, different export-panel props.
    rerender(<Step4Review {...reviewProps(INPUT_A, 'Red Sea worktop')} />);
    fireEvent.change(screen.getByLabelText('Save quote as'), { target: { value: 'x' } });

    expect(buildElement).toHaveBeenCalledTimes(1);
    expect(seen.children.length).toBe(1);
    expect(seen.children[0]).not.toBeNull();
  });

  it('rebuilds the element when the render input actually changes', () => {
    const { rerender } = render(<Step4Review {...reviewProps(INPUT_A)} />);
    rerender(<Step4Review {...reviewProps(INPUT_B)} />);

    expect(buildElement).toHaveBeenCalledTimes(2);
    expect(seen.children).toHaveLength(2);
    expect(seen.children[1]).not.toBe(seen.children[0]);
  });
});
