# Quotegen — Build Tracker

Working checklist against the `Build-kit/` contract. The kit itself is the source of
truth (its 05/07 docs are the *grading* rubric, not a build checklist), so progress is
tracked here. Mark items `[x]` when done and verified.

Legend: ✅ done & tested · 🚧 in progress · ⬜ not started

---

## Phase 0 — Repo & platform
- [x] Read all `Build-kit/` docs in order
- [x] Confirm no `[NEEDS CLARIFICATION]` markers remain (spec is decision-complete)
- [x] Reference project `~/Developer/rv002/ai-lab-platform` opened READ-ONLY (never written)
- [x] `gh` active account switched to `RA7AN`
- [x] Git repo initialised, rudimentary README, pushed to `github.com/RA7AN/quotegen` (private)
- [x] Feature branch `feat/quotegen-build` created from `main`

## Phase 1 — Deterministic foundation (engine) ✅
- [x] `src/lib/money.ts` — integer-halalas + string-exact `formatSar`, BigInt `divRoundHalfUp`, string parser
- [x] `src/lib/percent.ts` — integer-hundredths + largest-remainder splits, `percentOf`
- [x] `src/lib/dates.ts` — explicit ordinal table (no `Intl`/clock)
- [x] `src/lib/escape.ts` — escape-then-substitute helpers
- [x] `src/lib/filenames.ts` — FR-7.3 quotation + normalised proforma naming
- [x] `src/domain/types.ts` — Zod model (QuoteDocument / CompanyProfile / …), integer money
- [x] `src/domain/defaults.ts` — seeded Encompass/Elaf profile + terms + blank doc
- [x] `src/domain/calc.ts` — pure totals engine (line price, discount, VAT, grand, splits)
- [x] Unit tests: oracle 02 §4 (AC-1), float traps (AC-2), splits (AC-3), `formatSar` regex (AC-4), determinism (AC-6)
- [x] `tsc --noEmit` clean; `vitest run` 34/34 green

## Phase 2 — PDF layer ✅
- [x] `src/pdf/theme.ts` — LETTER geometry (612×792, margins top 122.4 / sides+bottom 72), colour tokens, font map + idempotent `registerFonts(resolver)` (§1–§5)
- [x] `src/pdf/primitives.tsx` — ChevronMotif, HeaderBand, FooterBand, EntityBlock, MetaField, LineItemsTable (quotation/proforma variants), TotalsStack (§2, §3.4)
- [x] `src/pdf/quotation.tsx` — 2-page shape (§3): title strip, meta, table, totals, payment terms, T&Cs, closing
- [x] `src/pdf/proforma.tsx` — 1-page shape (§4): MODE OF PAYMENT, ACCOUNT DETAILS (RTL Arabic line), included cells, advance row
- [x] `src/lib/rtl.ts` — deterministic Arabic presentation-form shaping (`arabic-persian-reshaper` + NotoSansArabic face) so the legal-name run renders joined/right-aligned, not tofu
- [x] `src/pdf/index.tsx` — `buildElement`/`makeInput`/`filenameFor` + `renderToBlob` (browser) / `renderToBuffer` (Node, collects the PDF stream) via `@react-pdf/renderer`
- [x] Brand assets: `header-mark.png` / `footer-mark.png` cropped from DOCX `word/media`; fonts bundled in `public/fonts` (Arimo, Open Sans, Noto Sans Arabic)
- [x] Deps added: `@react-pdf/renderer`, `react`, `react-dom`, `unpdf` (test), `arabic-persian-reshaper`
- [x] `tsc --noEmit` clean; `vitest run` 39/39 green (render tests: HP-1/2/3, Letter media box, byte-stable re-render)

## Phase 3 — Wizard & capture ✅
- [x] `src/wizard/wizard.tsx` — 3-step shell over `useReducer` (mirror of generator-wizard): `aria-current="step"` indicator (AC-7), debounced autosave, "Resume draft?"/corrupt-draft banners (HP-4 / AC-12 / EC-11)
- [x] `src/wizard/state.ts` — pure reducer + per-step validators (Node-testable): AC-8 round-trip, AC-10 renumber-by-index, split-sums-to-100 gating (11 tests)
- [x] `step1-meta.tsx`, `step2-lines.tsx`, `step3-review.tsx`, `line-item-editor.tsx`, `totals-panel.tsx`, `fields.tsx`
- [x] Step gating + inline field-level validation, no `alert()`/`confirm()` (AC-9); computed cells read-only text everywhere (AC-5)
- [x] Add/reorder/delete with contiguous renumbering (AC-10); descriptions wrap in the PDF table (AC-11, Phase-2 cell)
- [x] `src/lib/storage.ts` — versioned localStorage draft + snapshot codec (FR-6): `quotegen:{draft,quotes,profile}:v1` keys, v0→v1 migration (AC-13), corrupt data decodes to null/[] (EC-11), clock/random-free (AC-28-safe); 17 tests
- [x] Routes: `app/layout.tsx`, `app/page.tsx` (landing), `app/new`, `app/settings` (profile + factory reset, FR-5), `app/quotes` (open/duplicate/delete, FR-6.2)
- [x] Download/Print reuse the Phase-2 path: `makeInput` + `renderToBlob` from `src/pdf/index.tsx`; preview is the real PDF via `<PDFViewer>`
- [x] Deps: `next@16.4.3`, `tailwindcss@4` (+`@tailwindcss/postcss`), `next.config.ts` with `output: 'export'`; `next build` prerenders all 5 routes; 67/67 tests green

## Phase 4 — Eval harness & deploy (NEXT)
- [ ] `src/eval/fixtures/*.json` — HP-1..HP-3, calc-oracle, hostile-text
- [ ] `npm run eval` — calc gate, render gate, determinism gate, static grep gates (07)
- [ ] Vercel static config (`output: 'export'`), no API routes (AC-24)
- [ ] Dependency grep gate (AC-25); no-clock/no-random grep gate (AC-28)

---

## Deferred deliberately
Phase 0–3 (repo, engine, PDF layer, wizard + storage + routes) are complete and green.
Remaining: **Phase 4 — eval harness & deploy gates** (fixtures, `npm run eval`, static
grep gates, Vercel deploy). `next build` already succeeds with `output: 'export'`;
browser-level component tests (jsdom) were traded for pure-state unit tests over
`wizard/state.ts` (same AC-8/9/10 coverage without a DOM stack).
