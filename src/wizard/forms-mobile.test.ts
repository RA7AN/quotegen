/**
 * #50 — static gate for the wizard & forms mobile pass.
 *
 * Like the #49 chrome gate, the acceptance criteria here are about a viewport jsdom cannot
 * measure: "focusing a field does not zoom", "row controls are 44 px", "the action bar is
 * sticky", "the step-4 preview fills the screen". Those are facts about the CSS the source
 * emits, so they are pinned against the source rather than a 0×0 layout — a refactor that
 * quietly restores a 14 px input, a sub-44 px delete, or the fixed 900 px iframe fails
 * `npm test` instead of failing on a phone.
 *
 * Two shapes of assertion:
 *  1. A tag scanner proves NO text-entry element (`<input>`/`<textarea>`/`<select>`) carries
 *     a sub-16 px font on its own class token — the AC-1 iOS focus-zoom guard. It tracks
 *     brace/quote depth so an `onChange={(e) => …}` arrow's `>` never closes the tag early,
 *     and skips elements that inherit the shared `inputClass` token or are hidden `sr-only`.
 *  2. Named `toContain` / `not.toContain` checks per file, each naming the #50 AC it guards.
 *
 * Deliberately grep-shaped (see chrome-mobile.test.ts): `code()` strips comments so docblocks
 * that quote the *before* numbers stay legal.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel: string) => readFileSync(path.join(repoRoot, 'src', rel), 'utf8');
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:/\w])\/\/[^\n]*/g, '$1');

/**
 * Extract each `<input>`/`<textarea>`/`<select>` element's own attribute text by scanning to
 * its closing `>` at brace-depth 0 and outside quotes. Returns one string per tag containing
 * only that element's attributes (never a sibling or child).
 */
function textEntryAttrs(src: string): string[] {
  const out: string[] = [];
  const re = /<(input|textarea|select)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let i = re.lastIndex;
    let depth = 0;
    let quote = '';
    let attrs = '';
    for (; i < src.length; i++) {
      const ch = src[i];
      if (quote) {
        if (ch === quote) quote = '';
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch;
        continue;
      }
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '>' && depth === 0) break;
      attrs += ch;
    }
    out.push(attrs);
  }
  return out;
}

// Every file that renders a form control the user types into.
const FORM_FILES = [
  'wizard/fields.tsx',
  'wizard/step1-meta.tsx',
  'wizard/step2-lines.tsx',
  'wizard/step3-terms.tsx',
  'wizard/line-item-editor.tsx',
  'wizard/wizard.tsx',
  'wizard/step4-review.tsx',
  'profile/sections.tsx',
  'app/(app)/settings/settings-view.tsx',
  'app/(auth)/sign-in/page.tsx',
  'app/(auth)/sign-up/page.tsx',
  'app/(auth)/forgot-password/page.tsx',
  'app/(auth)/reset-password/page.tsx',
];

describe('text-entry font token (#50 AC-1 — no iOS focus-zoom)', () => {
  it('makes the shared inputClass token ≥16 px and ≥44 px, never small', () => {
    const token = read('wizard/fields.tsx').match(/export const inputClass =\s*\n?\s*'([^']*)'[\s\S]*?;/);
    expect(token, 'inputClass declaration not found').toBeTruthy();
    const cls = `${token![1]}`;
    expect(cls).toContain('text-base');
    expect(cls).toContain('min-h-[2.75rem]');
    expect(cls).not.toMatch(/text-(xs|sm)\b/);
  });

  it('puts no sub-16 px font on any text-entry control', () => {
    for (const rel of FORM_FILES) {
      const src = code(rel);
      for (const attrs of textEntryAttrs(src)) {
        // Inheriting the token, or an intentionally hidden file input, is fine.
        if (/\binputClass\b/.test(attrs)) continue;
        if (/className=[^\s]*sr-only/.test(attrs)) continue;
        expect(attrs, `${rel}: text-entry below 16px → ${attrs.trim().slice(0, 120)}`).not.toMatch(/\btext-(xs|sm)\b/);
      }
    }
  });

  it('gives numeric/telephone fields an inputMode so phones raise the right keypad', () => {
    const meta = code('wizard/step1-meta.tsx');
    expect(meta).toContain('inputMode="numeric"');
    const lines = code('wizard/line-item-editor.tsx');
    expect(lines).toContain('inputMode="decimal"');
  });
});

describe('step indicator + chrome above the fold (#50 AC-3)', () => {
  const wizard = code('wizard/wizard.tsx');

  it('keeps the progress chips on one non-wrapping, scrollable row', () => {
    expect(wizard).toContain('flex-nowrap');
    expect(wizard).toContain('overflow-x-auto');
    // One compact row ≤ 48 px: chips are 44 px tall, and the wrapped multi-line layout is gone.
    expect(wizard).toMatch(/min-h-\[2\.75rem\] whitespace-nowrap/);
  });

  it('keeps the full step label in the accessible name and explains a locked chip', () => {
    expect(wizard).toContain('aria-label={`${s.n}. ${s.label}`}');
    expect(wizard).toContain('title={allowed ? s.label :');
    // A hint tells the user why later steps are disabled while any remain locked.
    expect(wizard).toMatch(/Locked steps unlock/);
  });

  it('collapses the /new drafts grid behind a disclosure so the first field is near the top', () => {
    const strip = code('drafts/drafts-strip.tsx');
    expect(strip).toContain('collapsible');
    expect(strip).toContain('<details');
    expect(strip).toContain('<summary');
    expect(code('app/(app)/new/page.tsx')).toContain('collapsible');
  });
});

describe('navigation + errors + export bar (#50 AC-4/AC-6/AC-7)', () => {
  const wizard = code('wizard/wizard.tsx');

  it('docks Back / Save draft / Continue in a sticky bar above the tab bar', () => {
    expect(wizard).toContain('sticky bottom-[calc(4rem+env(safe-area-inset-bottom))]');
    expect(wizard).toMatch(/Continue →/);
  });

  it('scrolls to and focuses the first invalid field, and surfaces an error count', () => {
    expect(wizard).toContain("querySelector<HTMLElement>('[aria-invalid=\"true\"]')");
    expect(wizard).toContain("scrollIntoView({ block: 'center' })");
    expect(wizard).toContain('focus({ preventScroll: true })');
    expect(wizard).toMatch(/fields? need/);
  });

  it('never truncates the status/filename line (AC-6: no clipped text)', () => {
    expect(wizard).toContain('break-words');
    expect(wizard).not.toMatch(/className="[^"]*\btruncate\b[^"]*"/);
  });

  it('opens the print tab synchronously in the click, then points it at the blob', () => {
    // window.open must precede any await, or mobile drops it as a popup (AC-7).
    const open = wizard.indexOf("window.open('', '_blank')");
    const renderAwait = wizard.indexOf('await renderToBlob', wizard.indexOf('const print ='));
    expect(open).toBeGreaterThan(-1);
    expect(open).toBeLessThan(renderAwait);
    expect(wizard).toContain('tab.location.href =');
    // Blocked popup falls back to a download instead of silently doing nothing.
    expect(wizard).toMatch(/print tab was blocked/i);
  });
});

describe('step-4 preview fills the viewport (#50 AC-5)', () => {
  const step4 = code('wizard/step4-review.tsx');

  it('sizes the box to the viewport, not a fixed 900 px iframe', () => {
    expect(step4).not.toContain('height="900"');
    expect(step4).not.toContain('min-h-[640px]');
    expect(step4).toContain('h-[60svh]');
    expect(step4).toContain('height="100%"');
  });

  it('gives phones a full-screen toggle that resizes the SAME single viewer', () => {
    expect(step4).toContain('fixed inset-0 z-50');
    expect(step4).toMatch(/Full screen/);
    // Exactly one <PdfPreview ... /> mount — the memo stability depends on it.
    expect(step4.match(/<PdfPreview /g)).toHaveLength(1);
  });
});

describe('row + list editing controls (#50 AC-2)', () => {
  it('lifts line-item reorder/delete to 44 px and separates delete from reorder', () => {
    const lines = code('wizard/line-item-editor.tsx');
    expect(lines).toContain('inline-flex min-h-[2.75rem] min-w-[2.75rem]');
    // The destructive ✕ sits in its own divider group, not adjacent to ↑ ↓.
    expect(lines).toMatch(/border-l[^"]*pl-3/);
    expect(lines).toContain('gap-3');
  });

  it('keeps the clause insert grouped with reorder and delete behind a divider', () => {
    const terms = code('wizard/step3-terms.tsx');
    expect(terms).toMatch(/border-l[^"]*pl-3/);
    expect(terms).toContain('gap-3');
    expect(terms).toMatch(/min-h-\[2\.75rem\] min-w-\[2\.75rem\]/);
  });

  it('makes saved-library pick actions 44 px with an 8 px+ gap', () => {
    for (const rel of ['wizard/client-picker.tsx', 'wizard/signoff-picker.tsx', 'wizard/profile-picker.tsx']) {
      const f = code(rel);
      expect(f, rel).toContain('min-h-[2.75rem]');
      expect(f, rel).not.toMatch(/className="rounded bg-black px-2\.5 py-1/);
    }
  });
});

describe('settings shell (#50 AC-8)', () => {
  const settings = code('app/(app)/settings/settings-view.tsx');
  const sections = code('profile/sections.tsx');

  it('docks Save in a sticky bar that reports the dirty state', () => {
    expect(settings).toContain('sticky bottom-[calc(4rem+env(safe-area-inset-bottom))]');
    expect(settings).toContain('const dirty =');
    expect(settings).toMatch(/Unsaved changes|All changes saved/);
  });

  it('collapses each section behind a disclosure', () => {
    expect(sections).toContain('<details');
    expect(sections).toContain('<summary');
    expect(sections).toContain('collapsible');
  });

  it('uses label-as-button upload triggers with a hidden file input', () => {
    // The real <input type=file> stays in the DOM (aria-label kept for the getByLabelText
    // contract) but is visually sr-only; a styled <label htmlFor> is the 44 px trigger.
    expect(sections).toMatch(/className="sr-only"/);
    expect(sections).toMatch(/<label\s+htmlFor=\{id\}/);
    expect(sections).toContain('min-h-[2.75rem] cursor-pointer');
  });
});
