import type { QuoteDocument, CompanyProfile } from '@/domain/types';
import type { ComputedTotals } from '@/domain/calc';
import type { PdfAssets } from './primitives';

/** Everything a PDF template needs. Fully resolved, pure, no I/O. */
export type PdfInput = {
  doc: QuoteDocument;
  profile: CompanyProfile;
  totals: ComputedTotals;
  assets: PdfAssets;
};
