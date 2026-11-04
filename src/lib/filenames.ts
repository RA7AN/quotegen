/**
 * filenames.ts - FR-7.3 export filename builder.
 *
 *  - Quotation: ENCM-<YY>-<SEQ>.pdf, or ENCM-<PROJ>-<YY>-<SEQ>.pdf when a project
 *    segment is present (e.g. ENCM-26-6879.pdf, ENCM-178-26-6824.pdf).
 *  - Proforma: PROFORMA INVOICE <SEQ>-<CENTS>.pdf, mirroring the reference
 *    (PROFORMA INVOICE  5799-00 .pdf) but NORMALISED to a single space and trimmed.
 */

export type TemplateKind = 'quotation' | 'proforma';

export type FilenameInput = {
  template: TemplateKind;
  /** Authoritative document number from Step 1 (e.g. ENCM-178-26-6824 or 5799-00). */
  docNo: string;
};

const PROFORMA_PREFIX = 'PROFORMA INVOICE';

// Filesystem-hostile code points: \ / : * ? < > | "
const FORBIDDEN = new Set(
  [92, 47, 58, 42, 63, 60, 62, 124, 34].map((code) => String.fromCharCode(code)),
);

/** Collapse every run of whitespace to a single space and trim the ends. */
export function normaliseSpacing(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Strip filesystem-hostile characters, normalise spacing, then trim trailing
 * dots/space so the result is a safe filename stem. Throws if nothing remains.
 */
export function sanitiseFilenameBase(value: string): string {
  let out = '';
  for (const ch of value) {
    if (!FORBIDDEN.has(ch)) out += ch;
  }
  out = normaliseSpacing(out).replace(/[.\s]+$/, '');
  if (out === '') throw new RangeError('filenames: empty after sanitise');
  return out;
}

/** Quotation filename: the document number is authoritative, plus a `.pdf` suffix. */
export function quotationFilename(docNo: string): string {
  return `${sanitiseFilenameBase(docNo)}.pdf`;
}

/** Proforma filename: prefixed label + normalised single-spaced doc number. */
export function proformaFilename(docNo: string): string {
  return `${PROFORMA_PREFIX} ${sanitiseFilenameBase(docNo)}.pdf`;
}

/** Dispatch on template kind (FR-7.3). */
export function buildFilename(input: FilenameInput): string {
  return input.template === 'proforma'
    ? proformaFilename(input.docNo)
    : quotationFilename(input.docNo);
}
