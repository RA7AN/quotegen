/**
 * lib/inline.ts — a tiny, deterministic inline-markup codec for bold / italic / underline.
 *
 * Why markup tokens (not HTML): the PDF layer must stay literal (the hostile-text eval
 * asserts that `<b>`/`<i>` survive verbatim as plain text), and the renderer is
 * deterministic with no rich-text dependency. We therefore reserve three non-HTML token
 * pairs that users type or insert via the toolbar:
 *
 *   **bold**        → bold (renders with the 700 face)
 *   __underline__   → underline (textDecoration, no extra face needed)
 *   *italic*        → italic (needs an italic face; see theme.ts — currently renders upright)
 *
 * Parsing is non-nested and left-to-right. Unpaired tokens are emitted literally, so any
 * input without markup round-trips to a single run identical to the raw string. No
 * clock/random/network (this file lives under src/lib).
 */

export type InlineRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

/** Split `input` into styled runs. Empty/whitespace input yields a single empty run. */
export function parseInline(input: string): InlineRun[] {
  if (input.length === 0) return [{ text: '' }];

  const runs: InlineRun[] = [];
  let buf = '';
  let i = 0;

  const flush = (): void => {
    if (buf.length > 0) {
      runs.push({ text: buf });
      buf = '';
    }
  };

  while (i < input.length) {
    const two = input.slice(i, i + 2);

    // Bold: ** ... **
    if (two === '**') {
      const end = input.indexOf('**', i + 2);
      if (end > i + 2) {
        const seg = input.slice(i + 2, end);
        flush();
        runs.push({ text: seg, bold: true });
        i = end + 2;
        continue;
      }
    }

    // Underline: __ ... __
    if (two === '__') {
      const end = input.indexOf('__', i + 2);
      if (end > i + 2) {
        const seg = input.slice(i + 2, end);
        flush();
        runs.push({ text: seg, underline: true });
        i = end + 2;
        continue;
      }
    }

    // Italic: * ... *  (single star; the `**` case above already consumed paired doubles)
    if (input[i] === '*') {
      const end = input.indexOf('*', i + 1);
      if (end > i + 1) {
        const seg = input.slice(i + 1, end);
        flush();
        runs.push({ text: seg, italic: true });
        i = end + 1;
        continue;
      }
    }

    buf += input[i];
    i += 1;
  }

  flush();
  return runs.length > 0 ? runs : [{ text: '' }];
}

/** True when `text` contains at least one recognised markup token (for cheap guards). */
export function hasInlineMarkup(text: string): boolean {
  return /\*\*|__|\*/.test(text);
}
