# 02 — Technical Specification

## 1. Stack (decision-complete)

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Framework | **Next.js (App Router) + React 19 + TypeScript (strict)** | Matches the reference project (`ai-lab-platform`) so engineers reuse muscle memory; first-class Vercel deploy. |
| Styling | **Tailwind CSS** for app chrome (wizard UI) | Reference project uses Tailwind; fast, consistent. |
| PDF engine | **`@react-pdf/renderer`** | Pure-JS, vector PDF, selectable text, exact page geometry, runs in the browser **and** in Vercel serverless. **Replaces the reference project's Puppeteer**, which cannot run on Vercel (no Chromium binary). |
| On-screen preview | `@react-pdf/renderer` `<PDFViewer>` | Single source of truth: the preview IS the PDF. No HTML/PDF divergence. |
| Money math | **Integer halalas** + a tiny internal `money.ts` (no external decimal lib) | Deterministic, no float drift; mirrors `salary-breakdown.ts` integer-hundredths discipline. |
| Validation | **Zod** schemas at every boundary (form → snapshot → renderer input) | Same as reference project. |
| State | React state + `useReducer` for the wizard document; `localStorage` persistence layer | No backend in v1. |
| Tests | **Vitest** (unit) + a golden-PDF eval script (see 07) | Reference project uses Vitest. |
| Lint/format | ESLint (`eslint-config-next`) + Prettier | Reference project parity. |

**Explicitly forbidden**: `puppeteer`, `playwright`, `jspdf`+`html2canvas` (raster), any
LLM/`fetch` to an AI API in the generation path, any server-side native binary.

## 2. Repository & route layout

```
quotegen/
  package.json  next.config.ts  tsconfig.json  tailwind.config.ts  vitest.config.ts
  public/
    brand/                     # cropped logo marks + sampled swatches (see 03 §2)
      header-mark.png  footer-mark.png  chevrons.svg
    fonts/                     # bundled TTFs registered with @react-pdf (see 03 §4)
      Arimo-Regular.ttf  Arimo-Bold.ttf  OpenSans-Regular.ttf ...
  src/
    app/
      layout.tsx  page.tsx                 # landing → /new
      new/page.tsx                          # the wizard (client component)
      settings/page.tsx                     # company profile editor
      quotes/page.tsx                       # saved-snapshot list
    lib/
      money.ts                              # integer-halalas arithmetic + formatting
      percent.ts                            # integer-hundredths + largest-remainder split
      dates.ts                              # ISO ↔ "17th October 2026" ordinal formatting
      escape.ts                             # escape-then-substitute helpers
      storage.ts                            # versioned localStorage draft/snapshot codec
      filenames.ts                          # FR-7.3 filename builder
    domain/
      types.ts                              # QuoteDocument, CompanyProfile, zod schemas
      defaults.ts                           # seeded Encompass/Elaf profile + terms clauses
      calc.ts                               # pure: lines+commercials → ComputedTotals
    pdf/
      theme.ts                              # page geometry, colours, fonts, table widths
      primitives.tsx                        # Band, GoldRule, MetaTable, TotalsStack, Footer
      quotation.tsx                         # <QuotationDoc input={...}/>  (@react-pdf)
      proforma.tsx                          # <ProformaDoc input={...}/>   (@react-pdf)
      index.ts                              # renderToBlob(doc, profile) → {blob, filename}
    wizard/
      wizard.tsx                            # 3-step shell (mirror generator-wizard.tsx)
      step1-meta.tsx  step2-lines.tsx  step3-review.tsx
      line-item-editor.tsx  totals-panel.tsx
    eval/                                   # golden-fixture runner (see 07)
```

## 3. Determinism rules (the contract)

1. `calc.ts`, `money.ts`, `percent.ts`, `dates.ts`, and every `pdf/*.tsx` are **pure**:
   inputs in → outputs out. No `Date.now()`, `Math.random()`, `Intl` locale surprises
   (pin an explicit locale `'en-GB'`), no network.
2. Money is `bigint`-safe integers (halalas). Quantity is integer hundredths.
   `linePriceHalalas = roundHalfUp(unitPriceHalalas * qtyHundredths / 100)`.
3. Rounding is **round-half-up** applied once, at the boundary where a value is displayed
   or printed; intermediate sums stay integer.
4. VAT: `vatHalalas = roundHalfUp(baseHalalas * vatBps / 10000)`.
5. Splits: convert percents to integer hundredths; allocate with largest-remainder so
   `Σ parts === grandTotalHalalas` exactly (mirror `splitSalaryByPercentHundredths`).
6. Number formatting: `formatSar(halalas)` → `"1,234.56"` via integer string manipulation
   (not `Number.prototype.toLocaleString`, which is locale/environment dependent).
7. Dates: stored ISO `yyyy-mm-dd`; rendered `"17th October 2026"` / `"16th November, 2026"`
   by an explicit ordinal table (not `Intl.DateTimeFormat`).
8. Pagination is produced by `@react-pdf` from fixed geometry; the same input always
   paginates identically because fonts are bundled (no system-font fallback).

## 4. Calculation surface (worked reference values — the eval oracle)

These come from the reference PDFs and are the golden numbers the engine must reproduce:

| Case | Lines | Total | VAT (15%) | Grand |
|------|-------|-------|-----------|-------|
| Q-6824 | 5,300.00 ×1 | 5,300.00 | 795.00 | 6,095.00 |
| Q-6879 | 19,500.00×1 + 1,100.00×50 | 74,500.00 | 11,175.00 | 85,675.00 |
| PF-5799 | (discounted base) | 55,530.00 | 8,329.50 | 63,859.50 |
| PF-5799 advance 70% | — | — | — | 44,701.65 |

## 5. PDF pipeline

1. Wizard state → `QuoteDocument` (Zod-parsed snapshot).
2. `renderToBlob(doc, profile)`:
   - builds the template React element (`<QuotationDoc/>` or `<ProformaDoc/>`);
   - `@react-pdf/renderer` `pdf(element).toBlob()` in the browser for Download;
   - returns `{ blob, filename }` per FR-7.3.
3. Preview: `<PDFViewer document={element}/>` in step 3 (live, debounced).
4. Print fallback: a parallel `@media print` HTML view is **not** maintained. Instead the
   Print button triggers `Download PDF` then the browser's PDF viewer print, OR simply
   documents "use Download". (Keeps a single renderer — see non-goals.)
5. Fonts registered once at module load via `Font.register` from `/fonts/*` (bundled, so
   offline-safe and byte-stable).
6. Images: logo marks imported as static assets and passed to `<Image src={...}/>`;
   `@react-pdf` inlines them (no runtime network fetch).

### Why not Puppeteer (as in the reference project)?
Vercel serverless has no Chromium and the `/tmp`+binary constraints make Puppeteer
unreliable; the reference project runs Puppeteer in a long-lived worker, which Quotegen
does not have. `@react-pdf/renderer` gives an equivalent vector result with zero native
deps and full client-side operation. This is the single deliberate divergence from the
reference plumbing.

## 6. Vercel deployment

- `vercel.json`: none required (Next.js preset). Framework preset auto-detected.
- All routes are static/SSR shells; **no API routes, no server functions, no edge
  functions** in v1. Everything runs in the browser.
- Env vars: none required. (Optional `NEXT_PUBLIC_*` only for future analytics.)
- Build: `next build`; output static where possible (`output: 'export'` is acceptable and
  encouraged since there is no server — a pure static site on Vercel).
- Domain: any Vercel URL; the app is single-tenant by URL possession.

## 7. Security & privacy

- Escape-then-substitute for any string that reaches the PDF text layer (mirror
  `render.ts`); `@react-pdf` text nodes are already literal, but the discipline is kept
  for the HTML wizard preview.
- All data stays in the browser (`localStorage`). No uploads, no telemetry in v1.
- No secrets in the repo; brand assets are public marketing marks.

## 8. Testing strategy (summary; details in 07)

- Unit: `money`, `percent`, `calc`, `dates`, `filenames`, `storage` codec — table-driven,
  including the §4 oracle and float-trap cases (`0.1+0.2`, `1.005` rounding).
- Component: wizard gating, renumbering on reorder/delete, draft restore.
- Golden: render fixtures → PDF; assert extracted text + page count + computed numbers
  (see 07).
