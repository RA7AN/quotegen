import { describe, it, expect } from 'vitest';
import {
  furthestAllowedStep,
  initialWizardState,
  numberedLines,
  stepComplete,
  validateStep1,
  validateStep2,
  wizardReducer,
  type WizardState,
} from './state';
import type { LineItem, QuoteDocument } from '@/domain/types';

const line = (id: string, over: Partial<LineItem> = {}): LineItem => ({
  id, description: 'Supply of worktop', uom: 'u', qtyHundredths: 100, unitPriceHalalas: 530000, pricing: 'rated',
  ...over,
});

/** A fully valid Step-1 document (HP-1 values). */
function filledDoc(over: Partial<QuoteDocument> = {}): QuoteDocument {
  const s = initialWizardState();
  return {
    ...s.doc,
    meta: { docNo: 'ENCM-178-26-6824', quoteDateISO: '2026-10-17', validUntilISO: '2026-11-16', subject: 'Worktop', attn: 'Mr Mithun' },
    client: { name: 'THE RED SEA COASTAL VILLAGE HOTEL (DRR)', addressLines: ['Al Umlaj'], custId: '0020TBH', city: 'Al Umlaj', crNo: '4701102147' },
    lines: [line('a')],
    ...over,
  };
}

function apply(state: WizardState, actions: Parameters<typeof wizardReducer>[1][]): WizardState {
  return actions.reduce(wizardReducer, state);
}

describe('reducer — navigation preserves state (FR-2.2 / AC-8)', () => {
  it('1→2→3→2→1 round-trips every entered value', () => {
    const next = apply(initialWizardState(), [
      { type: 'setMeta', patch: { docNo: 'ENCM-26-6879' } },
      { type: 'setClient', patch: { name: 'Turtle Bay Hotel (TBH)' } },
      { type: 'goto', step: 2 },
      { type: 'addLine', id: 'x1', line: { description: 'Marble top', uom: 'u', qtyHundredths: 100, unitPriceHalalas: 1950000, pricing: 'rated' } },
      { type: 'setCommercials', patch: { vatBps: 1500 } },
      { type: 'goto', step: 3 },
      { type: 'goto', step: 2 },
      { type: 'goto', step: 1 },
    ]);
    expect(next.step).toBe(1);
    expect(next.doc.meta.docNo).toBe('ENCM-26-6879');
    expect(next.doc.client.name).toBe('Turtle Bay Hotel (TBH)');
    expect(next.doc.lines).toHaveLength(1);
    expect(next.doc.lines[0]).toMatchObject({ id: 'x1', unitPriceHalalas: 1950000 });
  });

  it('template switch keeps entered data', () => {
    const s = apply(initialWizardState(), [
      { type: 'setMeta', patch: { docNo: '5799-00' } },
      { type: 'setTemplate', template: 'proforma' },
    ]);
    expect(s.doc.template).toBe('proforma');
    expect(s.doc.meta.docNo).toBe('5799-00');
  });
});

describe('line ops — renumbering on reorder/delete (FR-3.1/3.2 / AC-10)', () => {
  const base = apply(initialWizardState(), [
    { type: 'addLine', id: 'a', line: { description: 'A', uom: 'u', qtyHundredths: 100, unitPriceHalalas: 1, pricing: 'rated' } },
    { type: 'addLine', id: 'b', line: { description: 'B', uom: 'u', qtyHundredths: 100, unitPriceHalalas: 1, pricing: 'rated' } },
    { type: 'addLine', id: 'c', line: { description: 'C', uom: 'u', qtyHundredths: 100, unitPriceHalalas: 1, pricing: 'rated' } },
  ]);

  it('S. No is contiguous 1..n after add', () => {
    expect(numberedLines(base.doc).map((n) => n.sno)).toEqual([1, 2, 3]);
  });

  it('reorder keeps numbering contiguous and moves the right row', () => {
    const moved = wizardReducer(base, { type: 'moveLine', id: 'c', dir: -1 });
    expect(numberedLines(moved.doc).map((n) => n.line.id)).toEqual(['a', 'c', 'b']);
    expect(numberedLines(moved.doc).map((n) => n.sno)).toEqual([1, 2, 3]);
  });

  it('delete renumbers without gaps or duplicates', () => {
    const after = wizardReducer(base, { type: 'deleteLine', id: 'a' });
    expect(numberedLines(after.doc).map((n) => n.sno)).toEqual([1, 2]);
    expect(numberedLines(after.doc).map((n) => n.line.id)).toEqual(['b', 'c']);
  });

  it('move at the boundaries is a no-op (no crash, no reorder)', () => {
    expect(wizardReducer(base, { type: 'moveLine', id: 'a', dir: -1 })).toBe(base);
    expect(wizardReducer(base, { type: 'moveLine', id: 'c', dir: 1 })).toBe(base);
    expect(wizardReducer(base, { type: 'moveLine', id: 'zz', dir: 1 })).toBe(base);
  });

  it('updateLine patches only the target row', () => {
    const up = wizardReducer(base, { type: 'updateLine', id: 'b', patch: { qtyHundredths: 5000 } });
    expect(up.doc.lines.map((l) => l.qtyHundredths)).toEqual([100, 5000, 100]);
    expect(base.doc.lines.map((l) => l.qtyHundredths)).toEqual([100, 100, 100]); // immutable
  });
});

describe('step gating (FR-2.3 / AC-9)', () => {
  it('blank wizard blocks step 1 with field-level messages', () => {
    const errors = validateStep1(initialWizardState().doc);
    expect(Object.keys(errors).sort()).toEqual(['client.name', 'meta.docNo', 'meta.quoteDateISO', 'meta.validUntilISO']);
    expect(furthestAllowedStep(initialWizardState().doc)).toBe(1);
  });

  it('invalid or non-calendar dates are rejected', () => {
    const doc = filledDoc({ meta: { docNo: 'X', quoteDateISO: '2026-02-30', validUntilISO: '17-10-2026', subject: '', attn: '' } });
    expect(validateStep1(doc)).toHaveProperty('meta.quoteDateISO');
    expect(validateStep1(doc)).toHaveProperty('meta.validUntilISO');
  });

  it('valid step 1 unlocks step 2; empty/blank-line step 2 blocks review', () => {
    expect(furthestAllowedStep(filledDoc())).toBe(3);
    expect(stepComplete(2, filledDoc({ lines: [] }))).toBe(false);
    expect(stepComplete(2, filledDoc({ lines: [line('a', { description: '   ' })] }))).toBe(false);
    expect(validateStep2(filledDoc({ lines: [line('a', { description: '' })] })))
      .toHaveProperty('line.a.description');
  });

  it('proforma splits must total exactly 100% to proceed (FR-4.6)', () => {
    const splits = (a: number, b: number) => [
      { label: `${a / 100}% Advance`, percentHundredths: a },
      { label: `${b / 100}% On completion`, percentHundredths: b },
    ];
    const doc = filledDoc({ template: 'proforma' });
    expect(validateStep2({ ...doc, commercials: { ...doc.commercials, advanceSplits: splits(7000, 2950) } }))
      .toHaveProperty('commercials.advanceSplits');
    expect(stepComplete(2, { ...doc, commercials: { ...doc.commercials, advanceSplits: splits(7000, 3000) } })).toBe(true);
    expect(stepComplete(2, { ...doc, commercials: { ...doc.commercials, advanceSplits: [] } })).toBe(true);
  });
});
