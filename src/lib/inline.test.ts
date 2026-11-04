import { describe, it, expect } from 'vitest';
import { parseInline, hasInlineMarkup } from './inline';

describe('parseInline', () => {
  it('returns a single plain run for text with no markup (verbatim round-trip)', () => {
    expect(parseInline('Supply of 3" marble & steel')).toEqual([{ text: 'Supply of 3" marble & steel' }]);
  });

  it('never interprets HTML tags (hostile-text stays literal)', () => {
    expect(parseInline('<b>bold claim</b> — <i>urgent</i>')).toEqual([{ text: '<b>bold claim</b> — <i>urgent</i>' }]);
  });

  it('parses bold, italic and underline runs', () => {
    expect(parseInline('a **b** c')).toEqual([
      { text: 'a ' },
      { text: 'b', bold: true },
      { text: ' c' },
    ]);
    expect(parseInline('x __y__ z')[1]).toEqual({ text: 'y', underline: true });
    expect(parseInline('p *q* r')[1]).toEqual({ text: 'q', italic: true });
  });

  it('handles several styled runs in one string', () => {
    expect(parseInline('**1** and *2* and __3__')).toEqual([
      { text: '1', bold: true },
      { text: ' and ' },
      { text: '2', italic: true },
      { text: ' and ' },
      { text: '3', underline: true },
    ]);
  });

  it('emits unpaired tokens literally', () => {
    expect(parseInline('2 * 3 = 6')).toEqual([{ text: '2 * 3 = 6' }]);
    expect(parseInline('trailing **')).toEqual([{ text: 'trailing **' }]);
  });

  it('empty input yields one empty run', () => {
    expect(parseInline('')).toEqual([{ text: '' }]);
  });

  it('hasInlineMarkup flags recognised tokens only', () => {
    expect(hasInlineMarkup('plain <b>text</b>')).toBe(false);
    expect(hasInlineMarkup('make **this** pop')).toBe(true);
  });
});
