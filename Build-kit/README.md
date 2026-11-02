# Quotegen — Build Kit (Build Contract)

Deterministic web quote/proforma builder. This folder is the **single source of truth** for
coding agents and engineers building the app, and for the eval harness that grades it
post-build. Read this README first, then the numbered docs in order.

| # | Doc | Purpose |
|---|-----|---------|
| 01 | [01-srs.md](./01-srs.md) | Software Requirements Specification: purpose, users, scope, functional & data requirements, workflows. |
| 02 | [02-tech-spec.md](./02-tech-spec.md) | Technical specification: stack, architecture, module layout, dependencies, determinism rules, PDF pipeline, Vercel deployment. |
| 03 | [03-template-fidelity.md](./03-template-fidelity.md) | 1:1 output-clone spec per document template (geometry, brand bands, tables, colours, fonts, pagination). |
| 04 | [04-goals-and-non-goals.md](./04-goals-and-non-goals.md) | What the product is and explicitly is not. |
| 05 | [05-acceptance-criteria.md](./05-acceptance-criteria.md) | Testable acceptance criteria (the eval rubric). |
| 06 | [06-happy-paths-and-edge-cases.md](./06-happy-paths-and-edge-cases.md) | End-to-end happy paths and the edge/error cases that must not break determinism. |
| 07 | [07-eval-plan.md](./07-eval-plan.md) | Post-build evaluation harness: fixtures, golden outputs, diffing, scoring. |

---

## Ground-truth inventory (read-only inputs)

These files define the **exact** target output. They are inputs, never modified.

| File | Role |
|------|------|
| `../Output-ref/ENCM-26-6879.docx` | Authoritative **Quotation** template source (Word). Page geometry, table structure, brand bands, fonts. |
| `../Output-ref/ENCM-26-6879.pdf` | Filled **Quotation** render (placeholder-flavoured). Visual target. |
| `../Output-ref/ENCM-178-26-6824.pdf` | Filled **Quotation** render (real data). Visual target + real-data example. |
| `../Output-ref/PROFORMA INVOICE  5799-00 .pdf` | Filled **Proforma Invoice** render. Visual target for template #2. |

Brand raster assets live inside the DOCX (`word/media/`): `image1.png` (the big
"QUOTATION" title strip + right-aligned company address block), `image2.jpeg` and
`image3.png` (letterhead band variants + footer band). See
[03-template-fidelity.md](./03-template-fidelity.md) for how to source logos/colours from
them. **Do not paste the full-page raster letterhead into the output** — rebuild the bands
as vector so they stay crisp and paginate (see fidelity doc §2).

## Reference implementation (read-only plumbing to mirror)

`~/Developer/rv002/ai-lab-platform` → `src/agents/offer-letter/`. **Read only; never write
into that folder.** The patterns to lift (not the code verbatim):

- `generator-wizard.tsx` — 3-step wizard (`useState<1|2|3>`), step restore, back/forward.
- `render.ts` — pure, framework-free HTML/PDF builder; **escape-then-substitute** security
  discipline; structural labels injected by the caller.
- `salary-breakdown.ts` — **integer-hundredths / largest-remainder** deterministic money &
  percent math. This is the model for all Quotegen arithmetic.
- `wizard-form-storage.ts` — localStorage draft autosave + restore.
- `offer-letter-print-document.ts` / `offer-letter-pdf-from-html.ts` — print CSS + PDF
  pipeline. **Quotegen replaces Puppeteer with `@react-pdf/renderer`** (Vercel-safe); see
  [02-tech-spec.md §5](./02-tech-spec.md).
- `detect-template.ts`, `seed-templates.ts` — template auto-detect + seeded defaults.
- `manifest.ts`, `sections/*` — agent/section organisation (mirrored as route organisation).

## Core invariants (non-negotiable)

1. **Deterministic**: same inputs ⇒ byte-stable layout and identical numbers, every time,
   on any machine. No LLM, no randomness, no wall-clock in the generation path except the
   explicit user-chosen dates.
2. **No manual math**: every total, VAT, discount and payment split is computed by the app
   from integer minor-units (halalas). Users never type a total.
3. **No manual formatting**: pagination, band placement, table widths, number formatting
   (`1,234.56`), ordinal dates (`17th October 2026`) are all produced by the renderer.
4. **One-click artefact**: a single action yields the final PDF named per convention.
5. **Vercel-deployable with zero native binaries**: no Puppeteer/Chromium, no OS-level deps.
