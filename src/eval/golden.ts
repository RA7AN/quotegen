/**
 * #4 — Golden-file pixel regression for template changes (07 §5).
 *
 * Rasterizes the three HP fixture PDFs (already rendered into src/eval/out/ by
 * `npm run eval:pdfs`) at a fixed DPI with poppler's `pdftoppm`, then compares
 * every page pixel-by-pixel against the committed goldens in src/eval/golden/.
 * The same engine runs on macOS (brew install poppler) and in CI (poppler-utils
 * is preinstalled on ubuntu-latest), so goldens are byte-comparable across
 * platforms — unlike a JS rasterizer, whose antialiasing differs per build.
 *
 * Usage:
 *   npm run eval:golden                  # compare; exit 1 on drift or missing goldens
 *   npm run eval:golden -- --update      # regenerate goldens for INTENTIONAL changes
 *     (07 §5: a goldens update must ship in a PR that cites the 03 §6
 *      allowed-upgrade entry or a spec amendment — never silently.)
 *
 * Failure artifacts: per-page diff PNGs (mismatched pixels in red) land in
 * src/eval/golden-out/diff/; CI uploads that directory when this step fails.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'out');
const goldenDir = path.join(here, 'golden');
const workDir = path.join(here, 'golden-out');
const diffDir = path.join(workDir, 'diff');

/** Fixed rasterization DPI — changing it invalidates every golden (bump deliberately). */
const DPI = 150;
/** pixelmatch per-pixel color sensitivity; below this a pixel counts as equal. */
const PIXEL_THRESHOLD = 0.1;
/**
 * Fraction of pixels allowed to differ before the page fails. The renderer is
 * deterministic (same poppler engine local + CI → 0 px on clean rebuilds), so
 * headroom only needs to absorb hinting jitter between poppler point releases;
 * a real layout/color/content change moves far more than this.
 */
const MAX_DIFF_RATIO = 0.001;

// The three happy-path fixtures only (07 §2): hostile text is a content probe,
// not a fidelity artifact, so it gets no golden.
const GOLDENS = [
  { pdf: 'ENCM-178-26-6824.pdf', name: 'hp1-quotation-6824' },
  { pdf: 'ENCM-26-6879.pdf', name: 'hp2-quotation-6879' },
  { pdf: 'PROFORMA INVOICE 5799-00.pdf', name: 'hp3-proforma-5799' },
] as const;

function requirePdftoppm(): void {
  try {
    execFileSync('pdftoppm', ['-v'], { stdio: 'pipe' });
  } catch {
    throw new Error(
      'pdftoppm not found — install poppler first:\n' +
        '  macOS:  brew install poppler\n' +
        '  Debian/Ubuntu (CI): apt-get install -y poppler-utils (preinstalled on ubuntu-latest)',
    );
  }
}

/** Rasterize `pdf` into `<name>-<page>.png` files under destDir; returns sorted paths. */
function rasterize(pdf: string, name: string, destDir: string): string[] {
  const src = path.join(outDir, pdf);
  if (!existsSync(src)) {
    throw new Error(`missing ${path.relative(process.cwd(), src)} — run "npm run eval:pdfs" first`);
  }
  mkdirSync(destDir, { recursive: true });
  execFileSync('pdftoppm', ['-png', '-r', String(DPI), '-f', '1', src, path.join(destDir, name)], {
    stdio: 'pipe',
  });
  return readdirSync(destDir)
    .filter((f) => f.startsWith(`${name}-`) && f.endsWith('.png'))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    .map((f) => path.join(destDir, f));
}

function cleanDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

const update = process.argv.includes('--update') || process.argv.includes('--update-goldens');
requirePdftoppm();

let failures = 0;
let comparedPages = 0;

if (update) {
  cleanDir(goldenDir);
  for (const g of GOLDENS) {
    const pages = rasterize(g.pdf, g.name, goldenDir);
    console.log(`golden: ${g.name} — ${pages.length} page(s) written`);
  }
  console.log(
    '\nGoldens regenerated. Per 07 §5, commit them ONLY in a PR citing the 03 §6\n' +
      'allowed-upgrade entry or the spec amendment that justifies each visual change.',
  );
} else {
  if (!existsSync(goldenDir) || readdirSync(goldenDir).filter((f) => f.endsWith('.png')).length === 0) {
    console.error('No goldens committed yet — generate them with: npm run eval:golden -- --update');
    process.exit(1);
  }
  cleanDir(workDir);
  const rows: string[] = [];
  for (const g of GOLDENS) {
    const fresh = rasterize(g.pdf, g.name, workDir);
    for (const page of fresh) {
      const golden = path.join(goldenDir, path.basename(page));
      comparedPages += 1;
      if (!existsSync(golden)) {
        rows.push(`  MISSING  ${path.basename(golden)} (new page? rerun with --update)`);
        failures += 1;
        continue;
      }
      const a = PNG.sync.read(readFileSync(page));
      const b = PNG.sync.read(readFileSync(golden));
      if (a.width !== b.width || a.height !== b.height) {
        rows.push(`  GEOMETRY ${path.basename(golden)}: ${a.width}x${a.height} != golden ${b.width}x${b.height}`);
        failures += 1;
        continue;
      }
      const diff = new PNG({ width: a.width, height: a.height });
      const changed = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
        threshold: PIXEL_THRESHOLD,
      });
      const ratio = changed / (a.width * a.height);
      if (ratio > MAX_DIFF_RATIO) {
        mkdirSync(diffDir, { recursive: true });
        const out = path.join(diffDir, path.basename(golden));
        writeFileSync(out, PNG.sync.write(diff));
        rows.push(`  DRIFT    ${path.basename(golden)}: ${(ratio * 100).toFixed(2)}% pixels differ (cap ${MAX_DIFF_RATIO * 100}%) → diff kept`);
        failures += 1;
      } else {
        rows.push(`  ok       ${path.basename(golden)} (${changed} px, ${(ratio * 100).toFixed(3)}%)`);
      }
    }
  }
  console.log(`golden pixel regression @ ${DPI} DPI — ${comparedPages} page(s):`);
  console.log(rows.join('\n'));
  if (failures > 0) {
    console.error(`\n${failures} page check(s) failed. Review the diff PNGs in src/eval/golden-out/diff/.`);
    console.error('If the change is intentional: npm run eval:golden -- --update, and cite 03 §6 in the PR (07 §5).');
    process.exit(1);
  }
}
