// @vitest-environment jsdom
/**
 * #3 — DOM tests for the line-item row (AC-10).
 *
 * Exercises the local raw-string commit rules the pure-state tests can't reach:
 * a valid quantity commits as parsed hundredths, an invalid one keeps the last
 * good value AND surfaces an inline role="alert"; reorder buttons disable at the
 * list boundaries; "included" pricing blanks the unit-price input and shows the
 * literal word instead of a computed figure.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { LineItemEditor } from './line-item-editor';
import type { LineItem } from '@/domain/types';

function makeLine(over: Partial<LineItem> = {}): LineItem {
  return {
    id: 'L1',
    description: 'Supply and install',
    uom: 'u',
    qtyHundredths: 100, // "1"
    unitPriceHalalas: 10_000, // SAR 100.00
    pricing: 'rated',
    ...over,
  };
}

function renderEditor(over: Partial<LineItem> = {}, props: Partial<Parameters<typeof LineItemEditor>[0]> = {}) {
  const onChange = vi.fn();
  const onMove = vi.fn();
  const onDelete = vi.fn();
  render(
    <LineItemEditor
      sno={1}
      line={makeLine(over)}
      isFirst
      isLast
      onChange={onChange}
      onMove={onMove}
      onDelete={onDelete}
      {...props}
    />,
  );
  return { onChange, onMove, onDelete };
}

beforeEach(() => cleanup());
afterEach(() => cleanup());

describe('LineItemEditor commit rules (AC-10)', () => {
  it('commits a parseable quantity as hundredths', () => {
    const { onChange } = renderEditor();
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '0.5' } });
    expect(onChange).toHaveBeenCalledWith({ qtyHundredths: 50 });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('rejects an unparseable quantity: no commit, inline alert, last valid value stays', () => {
    const { onChange } = renderEditor({ qtyHundredths: 250 });
    const qty = screen.getByLabelText('Quantity') as HTMLInputElement;
    fireEvent.change(qty, { target: { value: '1.5.5' } });
    expect(onChange).not.toHaveBeenCalled();
    expect((screen.getByRole('alert') as HTMLElement).textContent).toMatch('Enter a number');
    // Raw text is retained locally so the parser never fights the user.
    expect(qty.value).toBe('1.5.5');
  });

  it('commits a parseable unit price', () => {
    const { onChange } = renderEditor();
    fireEvent.change(screen.getByLabelText('Unit price (SAR)'), { target: { value: '1,234.56' } });
    expect(onChange).toHaveBeenCalledWith({ unitPriceHalalas: 123_456 });
  });
});

describe('LineItemEditor reorder + delete', () => {
  it('disables up/down at the respective boundaries', () => {
    renderEditor({}, { isFirst: true, isLast: false });
    expect((screen.getByLabelText('Move line 1 up') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Move line 1 down') as HTMLButtonElement).disabled).toBe(false);
  });

  it('moves on click when not at a boundary', () => {
    const { onMove } = renderEditor({}, { isFirst: false, isLast: false });
    fireEvent.click(screen.getByLabelText('Move line 1 up'));
    expect(onMove).toHaveBeenCalledWith(-1);
    fireEvent.click(screen.getByLabelText('Move line 1 down'));
    expect(onMove).toHaveBeenCalledWith(1);
  });

  it('deletes via the labelled remove button', () => {
    const { onDelete } = renderEditor();
    fireEvent.click(screen.getByLabelText('Delete line 1'));
    expect(onDelete).toHaveBeenCalledOnce();
  });
});

describe('LineItemEditor computed price', () => {
  it('shows the computed SAR price for a rated line', () => {
    renderEditor({ qtyHundredths: 200, unitPriceHalalas: 115_000 }); // 2 × SAR 1,150.00
    expect(screen.getByText('SAR 2,300.00')).toBeTruthy();
  });

  it('blanks the price input and prints "included" when marked included', () => {
    const { onChange } = renderEditor({ pricing: 'included' });
    const price = screen.getByLabelText('Unit price (SAR)') as HTMLInputElement;
    expect(price.disabled).toBe(true);
    expect(screen.getByText('included')).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Priced as/));
    expect(onChange).toHaveBeenCalledWith({ pricing: 'rated' });
  });

  it('surfaces a validation error passed from the parent under the description', () => {
    renderEditor({ description: '' }, { error: 'Description is required.' });
    expect(screen.getByRole('alert').textContent).toMatch('Description is required');
  });
});
