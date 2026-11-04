/**
 * eval/run-eval.ts — the automated harness (Build-kit/07 §2). Offline, deterministic
 * (`npm run eval`). Gates:
 *
 *  1. Calc gate       — calc-oracle.json rows vs computeTotals/line price/splits (AC-1..4)
 *  2. Render gate     — HP fixtures + hostile text → PDFs in src/eval/out/, extracted text
 *                       asserts page counts, media box, verbatim strings, section order
 *                       (AC-14, AC-16..18, AC-20 via text extraction, AC-22, AC-27, EC-7)
 *  3. Determinism     — render each fixture twice; identical text + page counts (AC-6, EC-14)
 *  4. Static gates    — banned deps (AC-25), no clock/random in render path (AC-28),
 *                       server code confined to the api/db/auth boundary (AC-24), no
 *                       alert/confirm in code (AC-9)
 *
 * Step 5 (unit suite) is chained by the npm script: `vitest run`.
 * Exit 0 = automated pass; a per-AC table is printed for the reviewer.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDocumentProxy, extractText } from 'unpdf';
import { computeTotals, computeLinePriceHalalas } from '@/domain/calc';
import { formatSar, parseDecimalToHalalas } from '@/lib/money';
import { splitByPercentHundredths } from '@/lib/percent';
import { QuoteDocumentSchema, type LineItem, type QuoteDocument } from '@/domain/types';
import { DEFAULT_COMPANY_PROFILE } from '@/domain/defaults';
import { registerFonts } from '@/pdf/theme';
import { makeInput, renderToBuffer, filenameFor } from '@/pdf/index';
import type { PdfAssets } from '@/pdf/primitives';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(here, '..');
const repoRoot = path.join(srcRoot, '..');
const fontsDir = path.join(repoRoot, 'public', 'fonts');
const outDir = path.join(here, 'out');
mkdirSync(outDir, { recursive: true });

// Node font provider: data URIs from the bundled files (same as the render tests).
registerFonts((file) => `data:font/${file.endsWith('.ttf') ? 'truetype' : 'opentype'};base64,${readFileSync(path.join(fontsDir, file)).toString('base64')}`);
// Brand marks as absolute file paths so the bands render in Node too (browser uses /brand URLs).
const assets: PdfAssets = {
  headerMark: path.join(repoRoot, 'public', 'brand', 'header-mark.png'),
  footerMark: path.join(repoRoot, 'public', 'brand', 'footer-mark.png'),
  headerBand: path.join(repoRoot, 'public', 'brand', 'header-band.jpg'),
  footerStrip: path.join(repoRoot, 'public', 'brand', 'footer-strip.jpg'),
  footerStripProforma: path.join(repoRoot, 'public', 'brand', 'footer-strip-proforma.png'),
};

type Row = { ac: string; label: string; pass: boolean; detail: string };
const results: Row[] = [];

async function check(ac: string, label: string, fn: () => string | Promise<string>): Promise<void> {
  let detail = '';
  let pass = false;
  try {
    detail = await fn();
    pass = true;
  } catch (err) {
    detail = err instanceof Error ? err.message : String(err);
  }
  results.push({ ac, label, pass, detail });
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(path.join(here, 'fixtures', name), 'utf8'));
}

/** Validate through the runtime boundary schema (entering data through a form, AC-12). */
function loadDoc(name: string): QuoteDocument {
  const parsed = QuoteDocumentSchema.safeParse(loadFixture(name));
  assert(parsed.success, `${name} fails QuoteDocumentSchema: ${(parsed as { error?: { issues: { path: (string | number)[]; message: string }[] } }).error?.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') ?? 'unknown'}`);
  return (parsed as { data: QuoteDocument }).data;
}

// ---------------------------------------------------------------------------
// Gate 1 — calc oracle (AC-1..AC-4)
// ---------------------------------------------------------------------------

const oracle = loadFixture('calc-oracle.json') as {
  rows: {
    name: string;
    lines: LineItem[];
    commercials: QuoteDocument['commercials'];
    expect: {
      totalHalalas: number; total: string; vatHalalas: number; vat: string;
      grandHalalas: number; grand: string;
      splits?: { label: string; halalas: number; formatted: string }[];
    };
  }[];
  lineCases: { name: string; qtyRaw: string; unitRaw: string; expectPriceHalalas: number; expectPrice: string }[];
  splitCases: { name: string; grandHalalas: number; percentHundredths: number[]; expectHalalas: number[] }[];
};

await check('AC-1..AC-3', 'calc: subtotal/VAT/grand + advance splits vs oracle rows', () => {
  const moneyFmt = /^[0-9,]+\.\d{2}$/; // grouping + exactly 2 decimals (AC-4)
  for (const row of oracle.rows) {
    const totals = computeTotals({ lines: row.lines, commercials: row.commercials });
    assert(totals.totalHalalas === row.expect.totalHalalas, `${row.name}: total ${totals.totalHalalas} != ${row.expect.totalHalalas}`);
    assert(totals.vatHalalas === row.expect.vatHalalas, `${row.name}: vat ${totals.vatHalalas} != ${row.expect.vatHalalas}`);
    assert(totals.grandTotalHalalas === row.expect.grandHalalas, `${row.name}: grand ${totals.grandTotalHalalas} != ${row.expect.grandHalalas}`);
    const fmt = { total: formatSar(totals.totalHalalas), vat: formatSar(totals.vatHalalas), grand: formatSar(totals.grandTotalHalalas) };
    assert(fmt.total === row.expect.total, `${row.name}: total fmt "${fmt.total}" != "${row.expect.total}"`);
    assert(fmt.vat === row.expect.vat, `${row.name}: vat fmt "${fmt.vat}" != "${row.expect.vat}"`);
    assert(fmt.grand === row.expect.grand, `${row.name}: grand fmt "${fmt.grand}" != "${row.expect.grand}"`);
    for (const m of Object.values(fmt)) assert(moneyFmt.test(m), `${row.name}: "${m}" violates money format (AC-4)`);
    for (const s of row.expect.splits ?? []) {
      const got = totals.splits.find((x) => x.label === s.label);
      assert(got, `${row.name}: split "${s.label}" missing`);
      assert(got!.halalas === s.halalas, `${row.name}: split ${s.label} ${got!.halalas} != ${s.halalas}`);
      assert(formatSar(got!.halalas) === s.formatted, `${row.name}: split fmt "${formatSar(got!.halalas)}" != "${s.formatted}"`);
    }
  }
  return `${oracle.rows.length} rows match the 02 §4 oracle`;
});

await check('AC-1/AC-2', 'calc: line-price cases (half-up at exact .5)', () => {
  for (const c of oracle.lineCases) {
    const qty = parseDecimalToHalalas(c.qtyRaw);
    const unit = parseDecimalToHalalas(c.unitRaw);
    assert(qty !== null && unit !== null, `${c.name}: raw inputs unparsable`);
    const price = computeLinePriceHalalas({
      id: c.name, description: '', uom: 'u',
      qtyHundredths: qty!, unitPriceHalalas: unit!, pricing: 'rated',
    });
    assert(price === c.expectPriceHalalas, `${c.name}: price ${price} != ${c.expectPriceHalalas}`);
    assert(formatSar(price) === c.expectPrice, `${c.name}: fmt "${formatSar(price)}" != "${c.expectPrice}"`);
  }
  return `${oracle.lineCases.length} EC cases (EC-1, EC-2)`;
});

await check('AC-3', 'calc: largest-remainder splits (sum preserved, no float drift)', () => {
  for (const c of oracle.splitCases) {
    const parts = splitByPercentHundredths(c.grandHalalas, c.percentHundredths);
    assert(parts.join(',') === c.expectHalalas.join(','), `${c.name}: ${parts.join(',')} != ${c.expectHalalas.join(',')}`);
    assert(parts.reduce((a, b) => a + b, 0) === c.grandHalalas, `${c.name}: parts do not sum to grand`);
  }
  return `${oracle.splitCases.length} split case (EC-3)`;
});

// ---------------------------------------------------------------------------
// Gate 2/3 — render + determinism (AC-6, AC-14..18, AC-20, AC-22, AC-27, EC-7, EC-14)
// ---------------------------------------------------------------------------

async function pdfFacts(buf: Uint8Array): Promise<{ text: string; pages: number; mediaOk: boolean }> {
  const pdfDoc = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdfDoc, { mergePages: true });
  const raw = Buffer.from(buf).toString('latin1');
  return {
    text: String(text),
    pages: pdfDoc.numPages,
    mediaOk: /\/MediaBox\s*\[\s*0\s+0\s+612\s+792\s*\]/.test(raw),
  };
}

type RenderCase = {
  fixture: string;
  minPages: number;
  fileName: string;
  verbatim: string[];            // entered strings + computed figures must appear verbatim (AC-18)
  order: string[];               // section/heading markers, in layout order (AC-16)
  headers?: { name: string; cells: string[] }; // column headers, exact + in order (AC-17)
};

const renderCases: RenderCase[] = [
  {
    fixture: 'hp1-quotation-6824.json',
    minPages: 2,
    fileName: 'ENCM-178-26-6824.pdf',
    verbatim: [
      'QUOTATION',
      'ENCM-178-26-6824',
      'THE RED SEA COASTAL VILLAGE HOTEL (DRR)',
      'Al Umlaj',
      '0020TBH',
      '4701102147',
      'Mr Mithun',
      'Supply of worktop for existing Kitchen Worktable',
      'Supply of White Marble top for work table - 220x90x2cm and Custom made SS304 Table bottom - 220x90x90cm',
      '17th October 2026',
      '16th November, 2026',
      'SAR 5,300.00',
      'SAR 795.00',
      'SAR 6,095.00',
      '100% advance',
      'Validity: This quotation is valid for 30 days from the date of issue.',
      'Best regards,',
      'WWW.ENCOMPASSGROUPSA.COM',
    ],
    order: ['QUOTATION', 'Quotation #:', 'Payment Terms', 'Terms & Conditions', 'Best regards,'],
    headers: {
      name: 'quotation columns',
      cells: ['S. No', 'Description', 'Unit Price (SAR)', 'UOM', 'Quantity', 'Price (SAR)'],
    },
  },
  {
    fixture: 'hp2-quotation-6879.json',
    minPages: 2,
    fileName: 'ENCM-26-6879.pdf',
    verbatim: [
      'ENCM-26-6879',
      'Turtle Bay Hotel (TBH)',
      'Kidds Club Floor',
      'Supply and install Granite cladding for Kidds Club floor',
      'Metal skirting profile along floor perimeter',
      '25th October 2026',
      '24th November, 2026',
      '19,500.00',
      '1,100.00',
      'SAR 55,000.00',
      'SAR 74,500.00',
      'SAR 11,175.00',
      'SAR 85,675.00',
      '70% advance',
      '30% on completion',
    ],
    order: ['QUOTATION', 'Payment Terms', 'Terms & Conditions', 'Best regards,'],
  },
  {
    fixture: 'hp3-proforma-5799.json',
    minPages: 1,
    fileName: 'PROFORMA INVOICE 5799-00.pdf',
    verbatim: [
      'PROFORMA INVOICE',
      'Turtle Bay Hotel (TBH)',
      'Jeddah',
      'Execution of fit-out works as per approved BOQ',
      'included',
      'BANK TRANSFER',
      'SA 50 6500 0000 2354 1754 8001',
      'SAR 55,530.00',
      'SAR 8,329.50',
      'SAR 63,859.50',
      'SAR 44,701.65',
    ],
    order: ['PROFORMA INVOICE', 'MODE OF PAYMENT', 'ACCOUNT DETAILS', 'Total after Discount', 'VAT', 'Grand Total', 'Advance'],
    headers: {
      name: 'proforma columns',
      cells: ['Sl.No', 'Description', 'Unit', 'Qty', 'Unit Rate (SAR)', 'Total (SAR)'],
    },
  },
  {
    fixture: 'hostile-text.json',
    minPages: 2,
    fileName: 'ENCM-26-9999.pdf',
    // EC-7 / AC-27: tag noise and punctuation survive verbatim as plain text.
    // The 🏗️ glyph is font-dependent, so it is not asserted.
    verbatim: [
      'HOTEL <script>alert(1)</script> A & B "Quotes"',
      "Street 'A' & 'B'",
      '<img onerror=hack(src)> District',
      "Mr O'Brien <script>alert(1)</script>",
      'A & B "quotes" works — <i>urgent</i>',
      'Supply of 3" marble & 2\' steel — <b>bold claim</b> — 100% advance',
      'SAR 1,000.00',
      'SAR 150.00',
      'SAR 1,150.00',
    ],
    order: ['QUOTATION', 'Terms & Conditions', 'Best regards,'],
  },
];

const rendered = new Map<string, { text: string; pages: number }>();

for (const rc of renderCases) {
  const doc = loadDoc(rc.fixture);
  const input = makeInput(doc, DEFAULT_COMPANY_PROFILE, assets);

  await check('AC-22', `filename: ${rc.fixture}`, () => {
    const got = filenameFor(doc);
    assert(got === rc.fileName, `filename "${got}" != "${rc.fileName}"`);
    return got;
  });

  const buffer = await renderToBuffer(input);
  writeFileSync(path.join(outDir, rc.fileName), buffer);
  const facts = await pdfFacts(buffer);
  rendered.set(rc.fixture, facts);

  await check('AC-14/AC-20', `geometry + selectable text: ${rc.fixture}`, () => {
    assert(facts.pages >= rc.minPages, `pages ${facts.pages} < ${rc.minPages}`);
    assert(facts.mediaOk, 'MediaBox is not 612x792 pt');
    assert(facts.text.trim().length > 50, 'no extractable text — AC-20 fail');
    return `${facts.pages} pages, text extractable`;
  });

  await check('AC-18/AC-27', `verbatim strings: ${rc.fixture}`, () => {
    // Cell wrapping makes pdfjs insert soft line breaks inside long strings; fall back
    // to a whitespace-squashed comparison so "verbatim" means "as entered" (AC-18).
    const squashed = facts.text.replace(/\s+/g, '');
    const missing = rc.verbatim.filter((needle) => {
      if (facts.text.includes(needle)) return false;
      return !squashed.includes(needle.replace(/\s+/g, ''));
    });
    assert(missing.length === 0, `missing from PDF text: ${JSON.stringify(missing)}`);
    return `${rc.verbatim.length} strings present`;
  });

  await check('AC-16', `section order: ${rc.fixture}`, () => {
    const squashed = facts.text.replace(/\s+/g, '');
    let at = -1;
    for (const marker of rc.order) {
      const idx = squashed.indexOf(marker.replace(/\s+/g, ''), at + 1);
      assert(idx >= 0, `section marker "${marker}" missing or out of order`);
      at = idx;
    }
    return rc.order.join(' < ');
  });

  if (rc.headers) {
    await check('AC-17', `${rc.headers.name}: ${rc.fixture}`, () => {
      const squashed = facts.text.replace(/\s+/g, '');
      let at = -1;
      for (const h of rc.headers!.cells) {
        const idx = squashed.indexOf(h.replace(/\s+/g, ''), at + 1);
        assert(idx >= 0, `column header "${h}" missing or out of order`);
        at = idx;
      }
      return rc.headers!.cells.join(' | ');
    });
  }
}

await check('AC-6/EC-14', 'determinism: second render identical (text + page count)', async () => {
  for (const rc of renderCases) {
    const doc = loadDoc(rc.fixture);
    const again = await pdfFacts(await renderToBuffer(makeInput(doc, DEFAULT_COMPANY_PROFILE, assets)));
    const first = rendered.get(rc.fixture)!;
    assert(again.pages === first.pages, `${rc.fixture}: page count drifted ${first.pages} -> ${again.pages}`);
    assert(again.text === first.text, `${rc.fixture}: extracted text differs between renders`);
  }
  return `${renderCases.length} fixtures rendered twice with identical output`;
});

// ---------------------------------------------------------------------------
// Gate 4 — static gates (AC-24 server boundary, AC-25, AC-28, AC-9)
// ---------------------------------------------------------------------------

function walk(dir: string, exts?: string[]): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...walk(full, exts));
    else if (!exts || exts.some((e) => entry.endsWith(e))) found.push(full);
  }
  return found;
}

/** Strip comments so docblocks mentioning the patterns don't trip call-site gates. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/[^\n]*/g, '$1');
}

// srcRoot / repoRoot are defined at the top of the file.

await check('AC-25', 'static: banned deps absent from package.json', () => {
  const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>; devDependencies?: Record<string, string>;
  };
  const all = { ...pkg.dependencies, ...pkg.devDependencies };
  const banned = /puppeteer|playwright|jspdf|html2canvas|openai|anthropic/i;
  const hit = Object.keys(all).filter((k) => banned.test(k));
  assert(hit.length === 0, `banned dependencies present: ${hit.join(', ')}`);
  return `${Object.keys(all).length} dependencies scanned`;
});

await check('AC-28', 'static: no Date.now()/Math.random() in src/lib|domain|pdf', () => {
  const files = [
    ...walk(path.join(srcRoot, 'lib'), ['.ts', '.tsx']),
    ...walk(path.join(srcRoot, 'domain'), ['.ts', '.tsx']),
    ...walk(path.join(srcRoot, 'pdf'), ['.ts', '.tsx']),
  ];
  const hits = files
    .filter((f) => /Date\.now\(|Math\.random\(/.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => path.relative(srcRoot, f));
  assert(hits.length === 0, `clock/random call sites in render path: ${hits.join(', ')}`);
  return `${files.length} files scanned`;
});

await check('AC-24', 'static: server code confined to the api/db/auth boundary; core stays pure', () => {
  const appDir = path.join(srcRoot, 'app');

  // 1) Route handlers may only live under src/app/api/** (no stray server entry points).
  const routes = walk(appDir).filter((f) => /route\.(ts|tsx)$/.test(f));
  const outsideApi = routes
    .map((f) => path.relative(appDir, f))
    .filter((rel) => !rel.startsWith(`api${path.sep}`))
    .map((rel) => path.relative(srcRoot, path.join(appDir, rel)));
  assert(outsideApi.length === 0, `routes outside src/app/api: ${outsideApi.join(', ')}`);

  // 2) The deterministic core (src/lib|domain|pdf) must NOT import server-only modules
  //    (@/db, @/auth, @/server, route handlers, or next/server). This is what keeps the
  //    static->serverful shift from leaking I/O into the byte-stable PDF/calc path.
  const serverImport = /from\s+['"]@\/(?:db|auth|server)(?:\/|[^'"]*[^'"])['"]|from\s+['"]next\/server['"]|\/route(?:\.ts)?['"]/;
  const coreFiles = ['lib', 'domain', 'pdf'].flatMap((d) => walk(path.join(srcRoot, d), ['.ts', '.tsx']));
  const leaks = coreFiles
    .filter((f) => serverImport.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => path.relative(srcRoot, f));
  assert(leaks.length === 0, `server-only imports leak into deterministic core: ${leaks.join(', ')}`);

  // 3) Build is serverful: next.config must no longer set output: 'export' (code, not prose).
  const cfg = stripComments(readFileSync(path.join(repoRoot, 'next.config.ts'), 'utf8'));
  assert(!/output:\s*'export'/.test(cfg), "next.config still sets output: 'export'");

  return `${routes.length} route file(s) under api; ${coreFiles.length} core files import-boundary clean`;
});

await check('AC-9', 'static: no alert()/confirm() calls in app code', () => {
  // Scan shipped code only: docblocks are stripped, and test/eval files legitimately
  // carry alert()/confirm() inside hostile-string fixtures (they are not UI call sites).
  const files = walk(srcRoot, ['.ts', '.tsx']).filter(
    (f) => !f.includes(`${path.sep}eval${path.sep}`) && !/\.test\.tsx?$/.test(f),
  );
  const hits = files
    .filter((f) => /\balert\(|\bconfirm\(/.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => path.relative(srcRoot, f));
  assert(hits.length === 0, `alert()/confirm() call sites: ${hits.join(', ')}`);
  return `${files.length} source files scanned`;
});

// ---------------------------------------------------------------------------
// Report (per-AC table for the reviewer) + exit code
// ---------------------------------------------------------------------------

const labelW = Math.max(...results.map((r) => r.label.length));
const acW = Math.max(...results.map((r) => r.ac.length));
console.log('\nQuotegen eval harness — automated ACs (07 §2)\n');
for (const r of results) {
  console.log(`  ${r.ac.padEnd(acW)}  ${r.label.padEnd(labelW)}  ${r.pass ? 'PASS' : 'FAIL'}  ${r.pass ? r.detail : `\n${' '.repeat(acW + 8)}${r.detail}`}`);
}
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed. PDF artifacts in ${path.relative(repoRoot, outDir)}/ for the visual review (07 §3).`);
process.exit(failed.length > 0 ? 1 : 0);
