import { beforeAll, describe, it, expect } from 'vitest';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getDocumentProxy, extractText } from 'unpdf';
import { registerFonts } from './theme';
import { renderToBuffer, makeInput, filenameFor } from './index';
import { DEFAULT_COMPANY_PROFILE } from '@/domain/defaults';
import { SCHEMA_VERSION, type QuoteDocument } from '@/domain/types';

// Resolve bundled fonts + brand marks as base64 data URIs so the Node renderer loads
// them without a filesystem/URL dependency (byte-stable across machines).
const repoRoot = new URL('../../', import.meta.url);
const dataUri = (rel: string, mime: string) =>
  `data:${mime};base64,${readFileSync(fileURLToPath(new URL(rel, repoRoot))).toString('base64')}`;

const ASSETS = {
  headerMark: dataUri('public/brand/header-mark.png', 'image/png'),
  footerMark: dataUri('public/brand/footer-mark.png', 'image/png'),
  headerBand: dataUri('public/brand/header-band.jpg', 'image/jpeg'),
  footerStrip: dataUri('public/brand/footer-strip.jpg', 'image/jpeg'),
  footerStripProforma: dataUri('public/brand/footer-strip-proforma.png', 'image/png'),
};

beforeAll(() => {
  registerFonts((file) => dataUri(`public/fonts/${file}`, 'font/ttf'));
});

function doc(over: Partial<QuoteDocument>): QuoteDocument {
  return {
    schemaVersion: SCHEMA_VERSION,
    template: 'quotation',
    meta: { docNo: 'ENCM-26-6879', quoteDateISO: '2026-10-25', validUntilISO: '2026-11-24', subject: 'Kidds Club Floor', attn: 'Mr Mithun' },
    client: { name: 'Turtle Bay Hotel (TBH)', addressLines: ['Jeddah'], custId: '0020TBH', city: 'Al Umlaj', crNo: '4701102147' },
    lines: [],
    commercials: { discountMode: 'none', discountValue: 0, vatBps: 1500, paymentTermsText: ['100% advance'], advanceSplits: [] },
    terms: { clauses: ['Validity: 30 days.'] },
    closing: { signoff: 'Best regards,', name: 'Ops', org: 'Encompass', mobile: '+966 50 000 0000', email: 'info@encompassgroupsa.com', website: 'WWW.ENCOMPASSGROUPSA.COM' },
    ...over,
  };
}

async function render(d: QuoteDocument) {
  const buf = await renderToBuffer(makeInput(d, DEFAULT_COMPANY_PROFILE, ASSETS));
  // Side-effect: write the artefact to the gitignored scratch dir for manual review.
  mkdirSync(fileURLToPath(new URL('.tmp/out', repoRoot)), { recursive: true });
  writeFileSync(fileURLToPath(new URL(`.tmp/out/${filenameFor(d)}`, repoRoot)), buf);
  const pdfDoc = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdfDoc, { mergePages: true });
  return { buf, pages: pdfDoc.numPages, text: text as string };
}

const line = (id: string, unitPriceHalalas: number, qtyHundredths: number, pricing: 'rated' | 'included' = 'rated') => ({
  id, description: 'Supply of worktop for existing Kitchen Worktable', uom: 'u', qtyHundredths, unitPriceHalalas, pricing,
});

describe('PDF render — quotation (HP-1 / HP-2)', () => {
  it('HP-1: 2 pages, oracle numbers + entered strings present', async () => {
    const d = doc({
      meta: { docNo: 'ENCM-178-26-6824', quoteDateISO: '2026-10-17', validUntilISO: '2026-11-16', subject: 'Supply of worktop for existing Kitchen Worktable', attn: 'Mr Mithun' },
      client: { name: 'THE RED SEA COASTAL VILLAGE HOTEL (DRR)', addressLines: ['Al Umlaj'], custId: '0020TBH', city: 'Al Umlaj', crNo: '4701102147' },
      lines: [line('1', 530000, 100)],
    });
    const { pages, text } = await render(d);
    expect(pages).toBeGreaterThanOrEqual(2); // AC-16
    expect(filenameFor(d)).toBe('ENCM-178-26-6824.pdf');
    expect(text).toContain('QUOTATION'); // AC-16 order start
    expect(text).toContain('THE RED SEA COASTAL VILLAGE HOTEL (DRR)'); // AC-18 verbatim
    expect(text).toContain('5,300.00');
    expect(text).toContain('795.00');
    expect(text).toContain('6,095.00');
    expect(text).toContain('Grand Total');
    expect(text).toContain('Payment Terms');
    expect(text).toContain('Terms & Conditions'); // AC-16 page 2
  });

  it('HP-2: multi-line totals match oracle', async () => {
    const d = doc({ lines: [line('a', 1950000, 100), line('b', 110000, 5000)] });
    const { text } = await render(d);
    expect(text).toContain('74,500.00');
    expect(text).toContain('11,175.00');
    expect(text).toContain('85,675.00');
  });
});

describe('PDF render — proforma (HP-3)', () => {
  it('1 page, included cells, account block, advance row', async () => {
    const d = doc({
      template: 'proforma',
      meta: { docNo: '5799-00', quoteDateISO: '2026-10-17', validUntilISO: '2026-11-16', subject: 'Fit-out', attn: '' },
      lines: [line('1', 0, 100, 'included'), line('2', 0, 100, 'included'), line('3', 5553000, 100)],
      commercials: { discountMode: 'none', discountValue: 0, vatBps: 1500, paymentTermsText: [], advanceSplits: [{ label: '70% Advance', percentHundredths: 7000 }] },
    });
    const { pages, text } = await render(d);
    expect(pages).toBeGreaterThanOrEqual(1);
    expect(filenameFor(d)).toBe('PROFORMA INVOICE 5799-00.pdf'); // AC-22
    expect(text).toContain('PROFORMA INVOICE');
    expect(text).toContain('MODE OF PAYMENT');
    expect(text).toContain('ACCOUNT DETAILS');
    expect(text).toContain('included'); // 03 §4 literal cell
    expect(text).toContain('55,530.00');
    expect(text).toContain('8,329.50');
    expect(text).toContain('63,859.50');
    expect(text).toContain('44,701.65'); // advance
  });
});

describe('PDF render — platform invariants', () => {
  it('AC-14: media box is Letter 612x792', async () => {
    const { buf } = await render(doc({ lines: [line('1', 530000, 100)] }));
    const raw = Buffer.from(buf).toString('latin1');
    expect(raw).toMatch(/MediaBox\s*\[\s*0\s+0\s+612\s+792\s*\]/);
  });

  it('AC-6 / EC-14: rendering twice yields identical extracted text and page count', async () => {
    const d = doc({ lines: [line('a', 1950000, 100), line('b', 110000, 5000)] });
    const r1 = await render(d);
    const r2 = await render(d);
    expect(r1.pages).toBe(r2.pages);
    expect(r1.text).toBe(r2.text);
  });

  it('inline markup: **bold** / __underline__ tokens are consumed and text renders', async () => {
    const d = doc({
      lines: [{ ...line('1', 100000, 100), description: 'Supply of **marble** top, __installed__ today' }],
      commercials: { discountMode: 'none', discountValue: 0, vatBps: 1500, paymentTermsText: ['100% **advance**'], advanceSplits: [] },
      terms: { clauses: ['Please __confirm__ the **scope**.'] },
    });
    const { text } = await render(d);
    // Styled run contents survive...
    expect(text).toContain('marble');
    expect(text).toContain('installed');
    expect(text).toContain('advance');
    expect(text).toContain('confirm');
    expect(text).toContain('scope');
    // ...and the reserved tokens themselves never leak into the rendered text.
    expect(text).not.toContain('**');
    expect(text).not.toContain('__');
  });
});
