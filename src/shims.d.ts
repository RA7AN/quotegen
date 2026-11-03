// Minimal typings for the untyped `arabic-persian-reshaper` dependency.
// It is a CJS package (`module.exports = { ArabicShaper, PersianShaper }`); under Node's
// ESM loader the named-export lexer detects nothing, so the interop-safe shape is the
// default export (Node and webpack both set `default` to `module.exports`).
declare module 'arabic-persian-reshaper' {
  const shapers: {
    ArabicShaper: {
      convertArabic(text: string): string;
      convertArabicBack(text: string): string;
    };
    PersianShaper: {
      convertPersian(text: string): string;
      convertPersianBack(text: string): string;
    };
  };
  export default shapers;
}
