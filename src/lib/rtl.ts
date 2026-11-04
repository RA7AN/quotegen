/**
 * lib/rtl.ts — deterministic Arabic presentation-form shaping (Build-kit/03 §4, NG-11).
 *
 * @react-pdf lays glyphs out left-to-right and does not perform the contextual
 * joining / right-to-left reordering Arabic needs, so an unshaped run renders as
 * isolated, reversed letters (or tofu if the face lacks the glyphs). We pre-shape to
 * the Arabic Presentation Forms block before handing the string to the renderer and use
 * a font (NotoSansArabic) that carries those codepoints. Pure and clock/random-free, so
 * it is safe inside the deterministic render path.
 */

import reshapers from 'arabic-persian-reshaper';

/** Reshape a logical-order Arabic string into reversed presentation forms for render. */
export function shapeArabicForRender(text: string): string {
  return reshapers.ArabicShaper.convertArabic(text);
}
