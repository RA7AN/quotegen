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

## Phase 2 — PDF layer (NEXT)
- [ ] `src/pdf/theme.ts` — LETTER geometry (612×792, margins), colour tokens, font map (§1–§5)
- [ ] `src/pdf/primitives.tsx` — Band, GoldRule, MetaTable, TotalsStack, Footer (§2, §3.4)
- [ ] `src/pdf/quotation.tsx` — 2-page shape (§3): title strip, meta, table, totals, payment terms, T&Cs, closing
- [ ] `src/pdf/proforma.tsx` — 1-page shape (§4): MODE OF PAYMENT, ACCOUNT DETAILS (RTL line), included cells, advance row
- [ ] `src/pdf/index.ts` — `renderToBlob(doc, profile) → { blob, filename }` via `@react-pdf/renderer`
- [ ] Brand assets: crop `header-mark.png` / `footer-mark.png` from DOCX `word/media`, `chevrons.svg`, bundle fonts (Arimo/Open Sans)
- [ ] Add deps: `@react-pdf/renderer`, `next`, `react`, `react-dom`, `tailwindcss`

## Phase 3 — Wizard & capture (NEXT)
- [ ] `src/wizard/wizard.tsx` — 3-step shell (`useState<1|2|3>`, aria-current) mirror of generator-wizard
- [ ] `step1-meta.tsx`, `step2-lines.tsx`, `step3-review.tsx`, `line-item-editor.tsx`, `totals-panel.tsx`
- [ ] Step gating + inline field-level validation (AC-9); read-only computed cells (AC-5)
- [ ] Add/reorder/delete renumbering (AC-10); 400-char wrap (AC-11)
- [ ] `src/lib/storage.ts` — versioned localStorage draft + snapshot codec (FR-6, schemaVersion migration AC-13)
- [ ] Routes: `app/page.tsx`, `app/new`, `app/settings`, `app/quotes`

## Phase 4 — Eval harness & deploy (NEXT)
- [ ] `src/eval/fixtures/*.json` — HP-1..HP-3, calc-oracle, hostile-text
- [ ] `npm run eval` — calc gate, render gate, determinism gate, static grep gates (07)
- [ ] Vercel static config (`output: 'export'`), no API routes (AC-24)
- [ ] Dependency grep gate (AC-25); no-clock/no-random grep gate (AC-28)

---

## Deferred deliberately this session
To keep the first increment coherent and green, the **PDF renderer, wizard UI and eval
harness** are deferred to the next step (Phases 2–4). Only the engine dependencies
(`zod`, `vitest`, `typescript`, `tsx`) are installed now; `@react-pdf/renderer`/`next`/
`react`/`tailwindcss` land with Phase 2. The `dev`/`build` scripts are pre-declared but
will only run once those deps exist.
