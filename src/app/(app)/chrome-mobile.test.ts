/**
 * #49 — static gate for the phone chrome.
 *
 * The jsdom suites can prove behaviour (focus, scroll lock, dismissal, routing), but they cannot
 * measure a viewport: "the header is one 56 px row", "the sheet is bottom-anchored" and "the toast
 * stack clears the tab bar" are facts about CSS classes that jsdom lays out as 0×0 for everything.
 * Those acceptance criteria from the audit are pinned here instead, against the source that emits
 * them, so a later refactor that quietly restores `100vh`, a wrapping nav or a 26 px row fails
 * `npm test` rather than failing on a phone.
 *
 * Deliberately grep-shaped (not snapshot-shaped): each assertion names the #49 criterion it
 * guards, and the negative ones target `className` attributes only so the audit numbers quoted in
 * docblocks stay legal.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const read = (rel: string) => readFileSync(path.join(repoRoot, 'src', rel), 'utf8');

/**
 * Source with comments removed. Each docblock in these files quotes the audit's *before* numbers
 * (`px-3 py-1 text-xs`, 128 px headers, `mousedown`), so the gate has to look at emitted code only
 * — otherwise every "this is gone now" assertion would be defeated by the note explaining it.
 */
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:/\w])\/\/[^\n]*/g, '$1');

describe('app shell header + tab bar (#49 AC-1/AC-2)', () => {
  const layout = code('app/(app)/layout.tsx');
  const tabBar = code('app/(app)/tab-bar.tsx');

  it('keeps the band to one fixed-height row and mounts the bottom bar', () => {
    expect(layout).toContain('<TabBar />');
    expect(layout).toContain('h-[3.25rem]'); // 52 px content + 4 px rule = 56 px ≤ 60 px
    // The six-link nav that wrapped is gone: no wrapping container, no `text-xs` link row.
    expect(layout).not.toContain('flex-wrap');
    expect(layout).not.toContain('NAV');
  });

  it('reserves page clearance for the fixed bar and its safe area', () => {
    expect(layout).toContain('pb-[calc(4rem+env(safe-area-inset-bottom))]');
    expect(tabBar).toContain('fixed inset-x-0 bottom-0');
    expect(tabBar).toContain('pb-[env(safe-area-inset-bottom)]');
  });

  it('gives every destination a ≥44 px tab', () => {
    // The tab classes are built in a template literal (active state), hence a code-level check.
    expect(tabBar).toContain('min-h-[3.25rem]');
    expect(tabBar).toContain('flex-1');
    // Secondary sections inside the More sheet are 48 px rows.
    expect(tabBar).toContain('min-h-[3rem]');
    expect(tabBar).toContain('min-h-[2.75rem]'); // Close
    // The sheet is capped and scrolls internally, like every other overlay (#49 AC-3).
    expect(tabBar).toContain('max-h-[80svh]');
    expect(tabBar).toContain('overflow-y-auto');
  });
});

describe('account menu panel (#49 AC-3)', () => {
  const menu = code('app/(app)/account-menu.tsx');

  it('dismisses on a touch-safe pointer event and on rotation', () => {
    expect(menu).toContain("addEventListener('pointerdown'");
    expect(menu).toContain("addEventListener('resize'");
    expect(menu).not.toContain("addEventListener('mousedown'");
  });

  it('clamps the panel into the viewport and sizes the trigger for a thumb', () => {
    expect(menu).toContain('max-w-[calc(100vw-2rem)]');
    expect(menu).toContain('min-h-[2.75rem]');
    expect(menu).toContain('min-w-[2.75rem]');
  });
});

describe('confirm dialog sheet (#49 AC-4)', () => {
  const dialog = code('wizard/confirm-dialog.tsx');
  const modal = code('ui/modal.tsx');

  it('is a bottom sheet on phones with a capped, internally scrollable panel', () => {
    expect(dialog).toContain('items-end');
    expect(dialog).toContain('sm:items-center');
    expect(dialog).toContain('max-h-[80svh]');
    expect(dialog).toContain('overflow-y-auto');
  });

  it('stacks 44 px buttons with a 12 px gap and focuses Cancel', () => {
    expect(dialog).toContain('min-h-[2.75rem]');
    expect(dialog).toContain('gap-3');
    expect(dialog).toContain('flex-col-reverse'); // Cancel sits under the primary action
    expect(dialog).toContain('useModal<HTMLDivElement>(open, onCancel, cancelRef)');
  });

  it('locks the page and traps focus through the shared primitive', () => {
    expect(modal).toContain("body.style.overflow = 'hidden'");
    expect(modal).toContain("body.style.overscrollBehavior = 'contain'");
    expect(modal).toContain("e.key === 'Escape'");
    expect(modal).toContain("e.key !== 'Tab'");
    // Restores the page and the trigger on unmount.
    expect(modal).toContain('body.style.overflow = previous.overflow');
    expect(modal).toContain('trigger.focus');
  });
});

describe('list rows + toasts (#49 AC-5/AC-6)', () => {
  const views = {
    recent: code('documents/recent-documents.tsx'),
    drafts: code('drafts/drafts-view.tsx'),
    quotes: code('app/(app)/quotes/quotes-view.tsx'),
  };

  it('retires the 26 px `px-3 py-1 text-xs` row buttons', () => {
    for (const [name, file] of Object.entries(views)) {
      expect(file.includes('px-3 py-1'), name).toBe(false);
    }
  });

  it('makes the row itself the primary target with 44 px secondary actions', () => {
    for (const [name, file] of Object.entries(views)) {
      expect(file.includes('min-h-[3rem]'), `${name} row`).toBe(true);
      expect(file.includes('min-h-[2.75rem]'), `${name} actions`).toBe(true);
      expect(file, `${name} names its open control`).toMatch(/aria-label=\{`Open /);
    }
  });

  it('routes the destructive /quotes delete through the confirm dialog', () => {
    expect(views.quotes).toContain('ConfirmDialog');
    expect(views.quotes).toContain('setPendingDelete');
    // No browser-native dialogs on any list (AC-9 lineage).
    for (const file of Object.values(views)) {
      expect(file).not.toMatch(/\b(confirm|alert)\s*\(/);
    }
  });

  it('lifts the saved-profile library rows out of 16 px text links (#49 AC-5)', () => {
    // /settings keeps its form layout for #50, but the library list has a destructive Delete, so
    // its controls belong to this issue's tap-target criterion.
    const settings = code('app/(app)/settings/settings-view.tsx');
    expect(settings).toContain('min-h-[2.75rem]');
    expect(settings).not.toMatch(/className="underline/);
    expect(code('profile/sections.tsx')).toContain('min-h-[2.75rem]');
  });

  it('floats the toast stack above the tab bar with a 44 px dismiss and a cap', () => {
    const fields = code('wizard/fields.tsx');
    expect(fields).toContain('bottom-[calc(4rem+env(safe-area-inset-bottom))]');
    expect(fields).toContain('inset-x-3');
    expect(fields).toContain('min-h-[2.75rem]');
    expect(fields).toContain('max = 2');
    expect(fields).toContain('+${hidden} more');
  });
});

describe('viewport units + global phone hardening (#49 AC-7/AC-8)', () => {
  const rootLayout = code('app/layout.tsx');
  const css = code('app/globals.css');

  it('uses dynamic viewport height instead of 100vh in every shell', () => {
    for (const rel of ['app/layout.tsx', 'app/(auth)/layout.tsx', 'app/(onboarding)/layout.tsx', 'app/(marketing)/layout.tsx']) {
      const file = code(rel);
      expect(file.includes('min-h-screen') || /\b100vh\b/.test(file), rel).toBe(false);
    }
    // The three shells that size a canvas to the viewport do it with `dvh`.
    for (const rel of ['app/layout.tsx', 'app/(auth)/layout.tsx', 'app/(onboarding)/layout.tsx']) {
      expect(code(rel), rel).toContain('100dvh');
    }
  });

  it('opts into viewport-fit=cover so env(safe-area-inset-*) is non-zero', () => {
    expect(rootLayout).toContain('viewportFit:');
    expect(rootLayout).toMatch(/export const viewport/);
  });

  it('pins text-size-adjust, touch-action and dialog overscroll in CSS', () => {
    expect(css).toContain('text-size-adjust: 100%');
    expect(css).toContain('touch-action: manipulation');
    expect(css).toContain('overscroll-behavior: contain');
    expect(css).toContain('@media (hover: none)');
  });

  it('never lets the chrome touch the PDF render path', () => {
    // globals.css is app-shell only; the PDF keeps its own tokens (AC-2/AC-22 lineage).
    const pdf = [code('pdf/index.tsx'), code('pdf/theme.ts'), code('pdf/quotation.tsx'), code('pdf/proforma.tsx')].join('\n');
    expect(pdf).not.toContain('globals.css');
    expect(pdf).not.toContain('tab-bar');
  });
});
