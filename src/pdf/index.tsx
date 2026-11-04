/**
 * pdf/index.tsx — the render entrypoint (Build-kit/02 §5).
 *
 * Builds the template element from a fully-resolved PdfInput and renders it to a Blob
 * (browser Download) or a Buffer (Node eval harness). Filename per FR-7.3.
 */

import { pdf } from '@react-pdf/renderer';
import { QuotationDoc } from './quotation';
import { ProformaDoc } from './proforma';
import { buildFilename } from '@/lib/filenames';
import { computeTotals } from '@/domain/calc';
import type { PdfInput } from './input';
import type { QuoteDocument, CompanyProfile } from '@/domain/types';
import type { PdfAssets } from './primitives';

// The renderer expects a root <Document> element; our builders return that shape.
type PdfRoot = Parameters<typeof pdf>[0];

/** Choose the template element (FR-1.3 explicit template). */
export function buildElement(input: PdfInput): PdfRoot {
  return input.doc.template === 'proforma'
    ? <ProformaDoc {...input} />
    : <QuotationDoc {...input} />;
}

/** Assemble a PdfInput from raw document + profile, resolving the calculation once. */
export function makeInput(
  doc: QuoteDocument,
  profile: CompanyProfile,
  assets: PdfAssets,
): PdfInput {
  return { doc, profile, assets, totals: computeTotals({ lines: doc.lines, commercials: doc.commercials }) };
}

/** Filename for a document (FR-7.3 / AC-22). */
export function filenameFor(doc: QuoteDocument): string {
  return buildFilename({ template: doc.template, docNo: doc.meta.docNo });
}

/** Client-side export (FR-7.1 / FR-7.4): no network, no server round-trip. */
export async function renderToBlob(input: PdfInput): Promise<{ blob: Blob; filename: string }> {
  const blob = await pdf(buildElement(input)).toBlob();
  return { blob, filename: filenameFor(input.doc) };
}

/** Node / eval-harness export: returns a Uint8Array buffer (collects the PDF stream). */
export async function renderToBuffer(input: PdfInput): Promise<Uint8Array> {
  const stream = await pdf(buildElement(input)).toBuffer();
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) chunks.push(chunk);
  const size = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}
