/**
 * lib/doc-number.ts — segmentation codec for the composed document number.
 *
 * Issue (wizard doc-number split): the persisted `meta.docNo` string remains the single
 * authoritative value (unchanged for filenames.ts, PDF renderers, storage). This module
 * is the pure parse/compose boundary the wizard uses to render/edit the doc number as
 * four independent fields on Quotation (prefix / project / year / seq) and two on
 * Proforma (seq / suffix).
 *
 * Shape grammar (quotation):
 *   ENCM-<YY>-<SEQ>                 → "ENCM-26-6879"    (no project)
 *   ENCM-<PROJ>-<YY>-<SEQ>          → "ENCM-178-26-6824"
 *   <LETTERS>-<...same tail>        → custom prefix (letters only, single dash)
 *   Prefix may omit its trailing dash; compose re-adds it.
 *   Year accepts 2 or 4 digits so "2026" and "26" both round-trip.
 *
 * Shape grammar (proforma, matching the reference PDF):
 *   <SEQ>-<SUFFIX>                  → "5799-00"
 *   <SEQ> alone                      → "5799"           (suffix empty)
 *
 * Anything that does not fit parses to null (EC-11 discipline: callers fall back to a
 * legacy raw-text field rather than corrupting stored values). Compose throws only when
 * required segments are missing — the UI guards against that before calling.
 *
 * Pure + clock/random free (AC-28): "default year" is passed in by the caller, never
 * computed here.
 */

export type TemplateKind = 'quotation' | 'proforma';

export type QuotationSegments = {
  /** Always normalised to end with `-` (compose) or include `-` (parse). */
  prefix: string;
  /** Project code, digits only. Empty string when absent from the doc number. */
  project: string;
  /** 2 or 4 digit year code as string; kept as string so "06" survives round-trip. */
  year: string;
  /** Sequence counter, digits only. */
  seq: string;
};

export type ProformaSegments = {
  seq: string;
  /** Suffix (usually "00"); empty string when the doc number is just `<SEQ>`. */
  suffix: string;
};

/** Letters (upper or lower) then `-`; then optional project, year, seq. */
const QUOTATION_RE = /^([A-Za-z]+)-(?:(\d+)-)?(\d{2}|\d{4})-(\d+)$/;

/** Proforma is `<digits>-<digits>` (suffix optional). */
const PROFORMA_RE = /^(\d+)(?:-(\d+))?$/;

/** Parse a quotation doc number into segments; null when the string does not fit. */
export function parseQuotationDocNo(value: string): QuotationSegments | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const m = QUOTATION_RE.exec(trimmed);
  if (!m) return null;
  const prefixRaw = m[1]!;
  const projectRaw = m[2]; // optional capture, undefined when the middle run is absent
  const year = m[3]!;
  const seq = m[4]!;
  return {
    // Regex captures the letters only; append the dash so parse output matches the
    // prefix shape compose() expects (stable round-trip).
    prefix: prefixRaw + '-',
    project: projectRaw ?? '',
    year,
    seq,
  };
}

/**
 * Compose a quotation doc number from segments. Throws RangeError when required parts
 * are blank so callers cannot accidentally write a malformed string into `meta.docNo`.
 * A prefix without a trailing dash gets one appended, so `ENCM` and `ENCM-` behave
 * identically from the UI's perspective.
 */
export function composeQuotationDocNo(parts: QuotationSegments): string {
  const prefix = normalisePrefix(parts.prefix);
  const year = parts.year.trim();
  const seq = parts.seq.trim();
  if (!prefix) throw new RangeError('doc-number: quotation prefix required');
  if (!year) throw new RangeError('doc-number: quotation year required');
  if (!seq) throw new RangeError('doc-number: quotation seq required');
  const project = parts.project.trim();
  const head = project ? `${prefix}${project}-` : prefix;
  return `${head}${year}-${seq}`;
}

/** Parse a proforma doc number (`5799-00` shape); null when the string does not fit. */
export function parseProformaDocNo(value: string): ProformaSegments | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const m = PROFORMA_RE.exec(trimmed);
  if (!m) return null;
  const seq = m[1]!;
  const suffix = m[2]; // optional capture
  return { seq, suffix: suffix ?? '' };
}

/** Compose a proforma doc number; blank suffix drops the `-<suffix>` tail entirely. */
export function composeProformaDocNo(parts: ProformaSegments): string {
  const seq = parts.seq.trim();
  if (!seq) throw new RangeError('doc-number: proforma seq required');
  const suffix = parts.suffix.trim();
  return suffix ? `${seq}-${suffix}` : seq;
}

/** Ensure the prefix ends with exactly one `-`; blank stays blank (compose rejects). */
export function normalisePrefix(value: string): string {
  const v = value.trim();
  if (!v) return '';
  return v.endsWith('-') ? v : `${v}-`;
}

/**
 * Seed segments for a blank new document. Callers pass the current 2-digit year so this
 * module stays clock-free (AC-28). `project` and `seq` use the factory defaults that
 * match the reference outputs; `prefix` defaults to `ENCM-`.
 */
export function defaultQuotationSegments(currentYearYY: string): QuotationSegments {
  return { prefix: 'ENCM-', project: '178', year: currentYearYY, seq: '6879' };
}

/** Proforma blank defaults: seq 5799, suffix 00 (matching `PROFORMA INVOICE 5799-00`). */
export function defaultProformaSegments(): ProformaSegments {
  return { seq: '5799', suffix: '00' };
}

/**
 * Parse whichever shape applies to the template; on failure return the seeded defaults
 * for a blank wizard. Callers use this to initialise the segmented row without needing
 * to handle every fallback branch themselves.
 */
export function segmentsFor(template: 'quotation', docNo: string, fallback: QuotationSegments): QuotationSegments;
export function segmentsFor(template: 'proforma', docNo: string, fallback: ProformaSegments): ProformaSegments;
export function segmentsFor(
  template: TemplateKind,
  docNo: string,
  fallback: QuotationSegments | ProformaSegments,
): QuotationSegments | ProformaSegments {
  if (!docNo.trim()) return fallback;
  const parsed = template === 'proforma' ? parseProformaDocNo(docNo) : parseQuotationDocNo(docNo);
  return parsed ?? fallback;
}
