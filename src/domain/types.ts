/**
 * domain/types.ts — the typed data model (Build-kit/01 §5) as Zod schemas.
 *
 * Every boundary is validated here: form -> snapshot -> renderer input. Money fields are
 * INTEGER halalas; quantities are INTEGER hundredths. There are no floats in the model.
 */

import { z } from 'zod';

/** Current snapshot schema version (FR-6.3). Bump when fields are added. */
export const SCHEMA_VERSION = 1;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected yyyy-mm-dd');
const nonNegativeInt = z.number().int().nonnegative();

export const CompanyLogoSchema = z.object({
  headerMark: z.string(),
  footerMark: z.string(),
});

export const SignatorySchema = z.object({
  name: z.string(),
  title: z.string(),
  mobile: z.string(),
  email: z.string(),
});

export const CompanyProfileSchema = z.object({
  legalNameEn: z.string(),
  legalNameAr: z.string().optional(),
  tagline: z.string(),
  addressLines: z.array(z.string()),
  phone: z.array(z.string()),
  mobile: z.string(),
  email: z.string(),
  website: z.string(),
  vatNo: z.string(),
  crNo: z.string(),
  bankName: z.string(),
  iban: z.string(),
  swift: z.string(),
  accountNo: z.string().optional(),
  signatory: SignatorySchema,
  logos: CompanyLogoSchema,
});

export const LineItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  uom: z.string(),
  /** Integer hundredths (0.5 m -> 50) so fractional quantities are exact (FR-3.4, EC-1). */
  qtyHundredths: nonNegativeInt,
  /** Integer halalas per unit; 0 for bundled/included lines. */
  unitPriceHalalas: nonNegativeInt,
  /** included lines print the literal word instead of numbers (03 §4). */
  pricing: z.enum(['rated', 'included']).default('rated'),
});

export const AdvanceSplitSchema = z.object({
  label: z.string(),
  /** Integer hundredths of a percent (70.00% -> 7000). */
  percentHundredths: z.number().int().min(0).max(10_000),
});

export const CommercialsSchema = z.object({
  discountMode: z.enum(['none', 'amount', 'percent']).default('none'),
  /**
   * Meaning depends on discountMode:
   *  - amount  -> integer halalas subtracted from the total
   *  - percent -> integer hundredths of a percent off the total
   *  - none    -> ignored
   */
  discountValue: nonNegativeInt.default(0),
  /** VAT rate in basis points; default 1500 = 15.00% (FR-4.4). */
  vatBps: z.number().int().min(0).max(10_000).default(1500),
  /** Free-text payment lines for the quotation template (FR-2.1 step 2). */
  paymentTermsText: z.array(z.string()).default([]),
  /** Percentage splits for the proforma advance (FR-4.6). */
  advanceSplits: z.array(AdvanceSplitSchema).default([]),
});

export const MetaSchema = z.object({
  docNo: z.string().min(1, 'document number is required'),
  projectSegment: z.string().optional(),
  quoteDateISO: isoDate,
  validUntilISO: isoDate,
  subject: z.string(),
  attn: z.string(),
});

export const ClientSchema = z.object({
  name: z.string().min(1, 'client name is required'),
  addressLines: z.array(z.string()).default([]),
  custId: z.string().default(''),
  city: z.string().default(''),
  crNo: z.string().default(''),
});

export const TermsSchema = z.object({
  clauses: z.array(z.string()).default([]),
});

export const ClosingSchema = z.object({
  signoff: z.string(),
  name: z.string(),
  org: z.string(),
  mobile: z.string(),
  email: z.string(),
  website: z.string(),
});

export const QuoteDocumentSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  template: z.enum(['quotation', 'proforma']).default('quotation'),
  meta: MetaSchema,
  client: ClientSchema,
  lines: z.array(LineItemSchema).default([]),
  commercials: CommercialsSchema.prefault({}),
  terms: TermsSchema.prefault({}),
  closing: ClosingSchema,
});

export type CompanyProfile = z.infer<typeof CompanyProfileSchema>;
export type Signatory = z.infer<typeof SignatorySchema>;
export type LineItem = z.infer<typeof LineItemSchema>;
export type AdvanceSplit = z.infer<typeof AdvanceSplitSchema>;
export type Commercials = z.infer<typeof CommercialsSchema>;
export type Meta = z.infer<typeof MetaSchema>;
export type Client = z.infer<typeof ClientSchema>;
export type Terms = z.infer<typeof TermsSchema>;
export type Closing = z.infer<typeof ClosingSchema>;
export type QuoteDocument = z.infer<typeof QuoteDocumentSchema>;
