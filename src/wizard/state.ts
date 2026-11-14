/**
 * wizard/state.ts — the wizard's pure state machine (Build-kit/01 FR-2, FR-3).
 *
 * Kept DOM-free (a plain reducer + validators) so step gating (FR-2.3 / AC-9),
 * state-preserving navigation (FR-2.2 / AC-8) and add/reorder/delete renumbering
 * (FR-3.1/3.2 / AC-10) are unit-testable in Node. `S. No` is never stored — it is the
 * row index + 1 at render time, so renumbering after reorder/delete is automatic and
 * gap-free by construction.
 */

import type { WizardStep } from '@/lib/storage';
import type {
  AdvanceSplit,
  Client,
  Closing,
  Commercials,
  LineItem,
  Meta,
  QuoteDocument,
} from '@/domain/types';
import { createBlankQuoteDocument } from '@/domain/defaults';
import { parseIsoDateParts } from '@/lib/dates';
import { percentsSumTo100 } from '@/lib/percent';

export type WizardState = {
  step: WizardStep;
  doc: QuoteDocument;
};

export type WizardAction =
  | { type: 'reset'; template?: 'quotation' | 'proforma' }
  | { type: 'hydrate'; step: WizardStep; doc: QuoteDocument }
  | { type: 'goto'; step: WizardStep }
  | { type: 'setTemplate'; template: 'quotation' | 'proforma' }
  | { type: 'setMeta'; patch: Partial<Meta> }
  | { type: 'setClient'; patch: Partial<Client> }
  | { type: 'setAddressLines'; lines: string[] }
  | { type: 'addLine'; line: Omit<LineItem, 'id'>; id: string }
  | { type: 'updateLine'; id: string; patch: Partial<Omit<LineItem, 'id'>> }
  | { type: 'deleteLine'; id: string }
  | { type: 'moveLine'; id: string; dir: -1 | 1 }
  | { type: 'setCommercials'; patch: Partial<Commercials> }
  | { type: 'setPaymentTerms'; lines: string[] }
  | { type: 'setSplits'; splits: AdvanceSplit[] }
  | { type: 'setTermsClauses'; clauses: string[] }
  | { type: 'setClosing'; patch: Partial<Closing> };

export function initialWizardState(): WizardState {
  return { step: 1, doc: createBlankQuoteDocument('quotation') };
}

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'reset':
      return { step: 1, doc: createBlankQuoteDocument(action.template) };
    case 'hydrate':
      return { step: action.step, doc: action.doc };
    case 'goto':
      return { ...state, step: action.step };
    case 'setTemplate':
      return { ...state, doc: { ...state.doc, template: action.template } };
    case 'setMeta':
      return { ...state, doc: { ...state.doc, meta: { ...state.doc.meta, ...action.patch } } };
    case 'setClient':
      return { ...state, doc: { ...state.doc, client: { ...state.doc.client, ...action.patch } } };
    case 'setAddressLines':
      return { ...state, doc: { ...state.doc, client: { ...state.doc.client, addressLines: action.lines } } };
    case 'addLine':
      return { ...state, doc: { ...state.doc, lines: [...state.doc.lines, { ...action.line, id: action.id }] } };
    case 'updateLine':
      return {
        ...state,
        doc: { ...state.doc, lines: state.doc.lines.map((l) => (l.id === action.id ? { ...l, ...action.patch } : l)) },
      };
    case 'deleteLine':
      return { ...state, doc: { ...state.doc, lines: state.doc.lines.filter((l) => l.id !== action.id) } };
    case 'moveLine': {
      const at = state.doc.lines.findIndex((l) => l.id === action.id);
      const to = at + action.dir;
      if (at < 0 || to < 0 || to >= state.doc.lines.length) return state;
      const lines = [...state.doc.lines];
      const moved = lines[at];
      if (!moved) return state;
      lines.splice(at, 1);
      lines.splice(to, 0, moved);
      return { ...state, doc: { ...state.doc, lines } };
    }
    case 'setCommercials':
      return { ...state, doc: { ...state.doc, commercials: { ...state.doc.commercials, ...action.patch } } };
    case 'setPaymentTerms':
      return {
        ...state,
        doc: { ...state.doc, commercials: { ...state.doc.commercials, paymentTermsText: action.lines } },
      };
    case 'setSplits':
      return { ...state, doc: { ...state.doc, commercials: { ...state.doc.commercials, advanceSplits: action.splits } } };
    case 'setTermsClauses':
      return { ...state, doc: { ...state.doc, terms: { clauses: action.clauses } } };
    case 'setClosing':
      return { ...state, doc: { ...state.doc, closing: { ...state.doc.closing, ...action.patch } } };
  }
}

// ---------------------------------------------------------------------------
// Step gating (FR-2.3 / AC-9) — field-level messages, no modals
// ---------------------------------------------------------------------------

export type FieldErrors = Record<string, string>;

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function checkIso(value: string): boolean {
  return ISO_RE.test(value) && parseIsoDateParts(value) !== null;
}

/** Whole days from `from` to `to` (pure calendar math via Date.UTC, no clock). */
function daysBetween(from: { year: number; month: number; day: number }, to: { year: number; month: number; day: number }): number {
  return Math.round((Date.UTC(to.year, to.month - 1, to.day) - Date.UTC(from.year, from.month - 1, from.day)) / 86_400_000);
}

/** FR-2.1: the quote must stay open at least this long after its own date. */
export const MIN_VALIDITY_DAYS = 30;

/** Required Step-1 fields (FR-2.1). Optional ones (custId/…) never block. */
export function validateStep1(doc: QuoteDocument): FieldErrors {
  const errors: FieldErrors = {};
  if (!doc.meta.docNo.trim()) errors['meta.docNo'] = 'Document number is required.';
  if (!checkIso(doc.meta.quoteDateISO)) errors['meta.quoteDateISO'] = 'Enter a date as yyyy-mm-dd.';
  if (!checkIso(doc.meta.validUntilISO)) errors['meta.validUntilISO'] = 'Enter a date as yyyy-mm-dd.';
  // Minimum validity window: "Valid until" must be ≥ 30 days after the quotation
  // date (the seeded default is exactly +30, so untouched forms always pass).
  // Only checked once BOTH dates parse — format errors win over gap errors.
  else {
    const quote = parseIsoDateParts(doc.meta.quoteDateISO);
    const until = parseIsoDateParts(doc.meta.validUntilISO);
    if (quote && until && daysBetween(quote, until) < MIN_VALIDITY_DAYS) {
      errors['meta.validUntilISO'] = `Valid until must be at least ${MIN_VALIDITY_DAYS} days after the quotation date.`;
    }
  }
  if (!doc.meta.attn.trim()) errors['meta.attn'] = 'Attention line is required.';
  if (!doc.client.name.trim()) errors['client.name'] = 'Client name is required.';
  return errors;
}

/** Required Step-2 content: at least one line with a description; splits must total 100%. */
export function validateStep2(doc: QuoteDocument): FieldErrors {
  const errors: FieldErrors = {};
  if (doc.lines.length === 0) errors['lines'] = 'Add at least one line item.';
  doc.lines.forEach((line, i) => {
    if (!line.description.trim()) errors[`line.${line.id}.description`] = `Line ${i + 1}: description is required.`;
  });
  if (doc.template === 'proforma' && doc.commercials.advanceSplits.length > 0) {
    const percents = doc.commercials.advanceSplits.map((s) => s.percentHundredths);
    if (!percentsSumTo100(percents)) errors['commercials.advanceSplits'] = 'Advance splits must add up to exactly 100%.';
  }
  return errors;
}

export function validateStep(step: WizardStep, doc: QuoteDocument): FieldErrors {
  if (step === 1) return validateStep1(doc);
  if (step === 2) return validateStep2(doc);
  return {}; // steps 3 (terms) and 4 (review) have no required fields
}

export function stepComplete(step: WizardStep, doc: QuoteDocument): boolean {
  return Object.keys(validateStep(step, doc)).length === 0;
}

/** Highest step the user may jump to: every earlier step must validate (FR-2.3). */
export function furthestAllowedStep(doc: QuoteDocument): WizardStep {
  if (stepComplete(1, doc) && stepComplete(2, doc)) return 4; // terms (3) never blocks, so review opens too
  return stepComplete(1, doc) ? 2 : 1;
}

/**
 * The earliest step before `target` that still fails validation — where a blocked
 * forward jump should bounce the user so the inline field errors become visible
 * (e.g. a draft restored under older rules that a later rule now rejects).
 */
export function blockingStep(doc: QuoteDocument, target: WizardStep): WizardStep | null {
  for (const s of [1, 2, 3] as const) {
    if (s >= target) break;
    if (!stepComplete(s, doc)) return s;
  }
  return null;
}

/** Sequence-numbered lines for display (FR-3.2): index + 1, contiguous by construction. */
export function numberedLines(doc: QuoteDocument): ReadonlyArray<{ sno: number; line: LineItem }> {
  return doc.lines.map((line, i) => ({ sno: i + 1, line }));
}
