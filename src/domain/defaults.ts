/**
 * domain/defaults.ts — seeded factory values (FR-5.2 reset-to-factory, FR-1.3 default).
 *
 * Company/brand values are taken from Build-kit/03 §2-§3 (the reference letterhead).
 * Anything the kit does not pin down (bank name, SWIFT, signatory) is seeded empty and
 * filled via Settings. NO clock/random here (this file lives under src/domain).
 */

import type { CompanyProfile, QuoteDocument } from './types';
import { SCHEMA_VERSION } from './types';

export const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  legalNameEn: 'ENCOMPASS DESIGN AND BUILD',
  legalNameAr: 'الاف اليامامة لخدمات المعادن',
  tagline: 'BUILDING DREAMS, ONE AT A TIME',
  addressLines: ['Riyadh, Kingdom of Saudi Arabia'],
  phone: ['+966 11 000 0000'],
  mobile: '+966 50 000 0000',
  email: 'info@encompassgroupsa.com',
  website: 'WWW.ENCOMPASSGROUPSA.COM',
  vatNo: '302000666700003',
  crNo: '4030183422',
  bankName: '',
  iban: 'SA 50 6500 0000 2354 1754 8001',
  swift: '',
  signatory: { name: '', title: '', mobile: '', email: '' },
  logos: { headerMark: '/brand/header-mark.png', footerMark: '/brand/footer-mark.png' },
};

/**
 * Fixed default clauses that seed every new quote (03 §3.6): validity first, scope
 * variation last. These are removable but flagged (the UI warns before deleting one).
 */
export const DEFAULT_FIRST_CLAUSE =
  'Validity: This quotation is valid for 30 days from the date of issue.';
export const DEFAULT_LAST_CLAUSE =
  'Scope Variation Clause: Adding or cancelling any item(s) or scope of works covered in the ' +
  'BOQ may result in adjustment of unit rates of other related items, except for items ' +
  'explicitly quoted as optional.';

/**
 * Optional clauses that are NOT added by default — the user accepts or dismisses them
 * from the terms stage. (Demoted from the old hard default so the middle terms are the
 * user's call.)
 */
export const SUGGESTED_TERMS_CLAUSES: string[] = [
  'Execution Time: Estimated Collection (Jeddah) within 10 days from PO and Advance Payment',
];

/** The clauses a blank document starts with: the two fixed defaults only. */
export const DEFAULT_TERMS_CLAUSES: string[] = [DEFAULT_FIRST_CLAUSE, DEFAULT_LAST_CLAUSE];

/** Closing paragraph (03 §3.6). */
export const DEFAULT_CLOSING_PARAGRAPH =
  'We trust this quotation meets your requirements and look forward to your positive ' +
  'response. For further clarifications, please feel free to contact us.';

export const DEFAULT_PAYMENT_TERMS_LINES: string[] = ['100% advance'];

/** Common UOM defaults offered in the line-item editor (FR-3.4). */
export const DEFAULT_UOM_OPTIONS: string[] = ['u', 'm', 'No', 'Ls', 'm²', 'set'];

/** A blank starting document for the wizard (dates are user-chosen; validated on export). */
export function createBlankQuoteDocument(template: 'quotation' | 'proforma' = 'quotation'): QuoteDocument {
  return {
    schemaVersion: SCHEMA_VERSION,
    template,
    meta: {
      docNo: '',
      quoteDateISO: '',
      validUntilISO: '',
      subject: '',
      attn: '',
    },
    client: { name: '', addressLines: [], custId: '', city: '', crNo: '' },
    lines: [],
    commercials: {
      discountMode: 'none',
      discountValue: 0,
      vatBps: 1500,
      paymentTermsText: [...DEFAULT_PAYMENT_TERMS_LINES],
      advanceSplits: [],
    },
    terms: { clauses: [...DEFAULT_TERMS_CLAUSES] },
    closing: {
      signoff: 'Best regards,',
      name: DEFAULT_COMPANY_PROFILE.signatory.name,
      org: DEFAULT_COMPANY_PROFILE.legalNameEn,
      mobile: DEFAULT_COMPANY_PROFILE.signatory.mobile,
      email: DEFAULT_COMPANY_PROFILE.signatory.email,
      website: DEFAULT_COMPANY_PROFILE.website,
    },
  };
}
