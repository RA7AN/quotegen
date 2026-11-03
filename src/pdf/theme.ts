/**
 * pdf/theme.ts — page geometry, colour tokens, font map (Build-kit/03 §1-§5).
 *
 * Pure constants + an idempotent font registrar. No clock/random/network. Fonts are
 * resolved through a caller-supplied resolver so the SAME registration works in the
 * browser (`/fonts/*`) and in the Node eval harness (base64 data URIs).
 */

import { Font } from '@react-pdf/renderer';

/** US Letter in points (03 §1). Every reference artefact is Letter, not A4. */
export const PAGE = {
  size: 'LETTER' as const,
  widthPt: 612,
  heightPt: 792,
  margin: { top: 122.4, right: 72, bottom: 72, left: 72 },
  headerFooterOffsetPt: 36,
} as const;

/** Content width inside the side margins. */
export const CONTENT_WIDTH_PT = PAGE.widthPt - PAGE.margin.left - PAGE.margin.right; // 468

/** Colour tokens sampled from the DOCX / letterhead (03 §2.3). */
export const COLORS = {
  ink: '#000000',
  muted: '#7D7D7D',
  band: '#000000',
  goldDark: '#4A3608',
  gold: '#A8842C',
  goldLight: '#C9A227',
  paper: '#FFFFFF',
  headerShade: '#EDEDED',
  zebraTint: '#F7F7F7',
} as const;

/** Font family names registered with @react-pdf (03 §5). */
export const FONTS = {
  body: 'Arimo',
  bold: 'Arimo', // bold is the 700 face of the same family
  display: 'Arimo', // the QUOTATION word
  band: 'OpenSans', // band / tagline uppercase
  arabic: 'NotoSansArabic', // the single RTL legal-name run (03 §4, NG-11)
} as const;

/** Bundled font files (public/fonts/*). */
export const FONT_FILES = {
  arimoRegular: 'Arimo-Regular.ttf',
  arimoBold: 'Arimo-Bold.ttf',
  openSansRegular: 'OpenSans-Regular.ttf',
  openSansBold: 'OpenSans-Bold.ttf',
  arabicRegular: 'NotoSansArabic-Regular.ttf',
  arabicBold: 'NotoSansArabic-Bold.ttf',
} as const;

let registered = false;

/**
 * Register the bundled faces exactly once. `resolve` maps a filename to a source the
 * renderer can load (a URL in the browser, a `data:` URI or absolute path in Node).
 */
export function registerFonts(resolve: (file: string) => string): void {
  if (registered) return;
  Font.register({
    family: FONTS.body,
    fonts: [
      { src: resolve(FONT_FILES.arimoRegular), fontWeight: 400 },
      { src: resolve(FONT_FILES.arimoBold), fontWeight: 700 },
    ],
  });
  Font.register({
    family: FONTS.band,
    fonts: [
      { src: resolve(FONT_FILES.openSansRegular), fontWeight: 400 },
      { src: resolve(FONT_FILES.openSansBold), fontWeight: 700 },
    ],
  });
  Font.register({
    family: FONTS.arabic,
    fonts: [
      { src: resolve(FONT_FILES.arabicRegular), fontWeight: 400 },
      { src: resolve(FONT_FILES.arabicBold), fontWeight: 700 },
    ],
  });
  registered = true;
}

/** Test hook / SSR safety: forget the registration guard (rarely needed). */
export function __resetFontRegistration(): void {
  registered = false;
}

/** Line-item column widths (pt) summing to CONTENT_WIDTH_PT = 468 (03 §3.3). */
export const LINE_COLUMNS = {
  sno: 28,
  description: 184,
  unitPrice: 68,
  uom: 36,
  quantity: 56, // wide enough for the bold "Quantity" header to fit on one line (no hyphen wrap)
  price: 96,
} as const;
