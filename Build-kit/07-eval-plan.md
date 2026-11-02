# 07 — Post-Build Evaluation Plan

The eval grades the finished build against this kit. Two layers: an **automated harness**
(CI + a local script) and a **human visual review**. Both consume the same fixtures.

## 1. Fixtures

`src/eval/fixtures/` holds one JSON snapshot per happy path, seeded with the exact values
in 06 (HP-1…HP-3) plus the edge cases EC-1…EC-10 as compact calc-only fixtures:

```
fixtures/
  hp1-quotation-6824.json     # full QuoteDocument snapshot
  hp2-quotation-6879.json
  hp3-proforma-5799.json
  calc-oracle.json            # the 02 §4 table + EC-1..EC-3 money cases
  hostile-text.json           # EC-7
```

Each fixture is a `QuoteDocument` (01 §5) so the harness drives `calc.ts` and the PDF
renderer directly, without the UI.

## 2. Automated harness (`npm run eval`)

Steps, all offline:

1. **Calc gate**: for every row in `calc-oracle.json`, assert `calc.ts` output equals the
   expected halalas + formatted string. (AC-1…AC-4)
2. **Render gate**: for each HP fixture, `renderToBlob` → write
   `out/<name>.pdf`; extract text (pdf-parse/pdfjs) and assert:
   - page count (quotation ≥2, proforma ≥1); media box 612×792 (AC-14);
   - every entered string present verbatim; every computed figure present as
     `SAR X,XXX.00` (AC-18);
   - section/heading presence & order per template (AC-16, AC-17).
3. **Determinism gate**: render each fixture twice; assert identical extracted text and
   identical page counts (AC-6, EC-14).
4. **Static gates** (grep/AST): no `puppeteer|playwright|jspdf|html2canvas|openai|anthropic`
   in `package.json`; no `Date.now(|Math.random(` in `src/lib|src/domain|src/pdf`; no
   `route.ts` under `src/app`; no `alert(|confirm(` in `src/` (AC-25, AC-28, AC-24, AC-9).
5. **Unit suite**: `vitest run` for money/percent/dates/filenames/storage + component
   tests (AC-5, AC-8, AC-10, AC-12, AC-13).

Exit code 0 = automated pass. The harness prints a per-AC table for the reviewer.

## 3. Human visual review (AC-19)

1. Open `out/hp1-quotation-6824.pdf` beside `../Output-ref/ENCM-178-26-6824.pdf`;
   repeat for hp2/`ENCM-26-6879.pdf` and hp3/`PROFORMA INVOICE  5799-00 .pdf`.
2. Compare page-by-page: band placement & colours, title strip, meta table, table columns
   & alignment, totals stack, payment terms, page-2 terms/closing, footer bands.
3. Mark each deviation as either (a) on the allowed-upgrade list (03 §6) → acceptable, or
   (b) off-list → **fail**, file against 03 with a screenshot.
4. Confirm text is selectable (AC-20) and the PDF opens cleanly in Preview/Chrome.

## 4. Scoring & release gate

| Layer | Weight | Pass condition |
|-------|--------|----------------|
| Automated harness | blocking | exit 0 (all auto ACs) |
| Human visual (per template) | blocking | no off-list deviation |
| Happy-path walkthrough (06) | blocking | HP-1…HP-4 complete end-to-end on the deployed Vercel URL |
| Edge cases (06) | blocking | EC-1…EC-14 behave as specified |

Release is blocked on any failing row. There is no partial-credit release.

## 5. Regression policy

Any future change to `calc.ts`, `pdf/*`, or `theme.ts` must re-run the full harness and the
visual review for both templates before merge; the oracle values in 02 §4 are immutable
unless the reference documents themselves change (in which case update Output-ref and this
kit together, in one commit).
