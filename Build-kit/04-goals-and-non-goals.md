# 04 — Goals & Non-Goals

## Goals

- **G-1 Speed**: a competent operator goes from blank to downloaded, client-ready PDF in
  under 3 minutes for a typical 1–10 line quote.
- **G-2 Zero grunt work**: the user never formats, never computes a total/VAT/split, never
  re-types company/bank/brand details, never fixes pagination or a typo'd total.
- **G-3 Determinism**: identical inputs always produce identical numbers and identical
  layout, on any machine, at any time. The output is a pure function of the inputs.
- **G-4 Fidelity**: the PDF is a 1:1 clone of the reference documents (modulo the allowed
  upgrades in 03 §6), so clients see the same branded artefact they see today.
- **G-5 Deployability**: runs as a Vercel web app reached by URL, with no server, no DB,
  no native binaries, no paid infra.
- **G-6 Recoverability**: an interrupted session resumes exactly where it left off
  (localStorage draft); finished quotes can be saved, reopened, duplicated.
- **G-7 Evalvability**: every requirement has a testable acceptance criterion (05) and the
  whole artefact is gradeable by an automated + visual eval harness (07).

## Non-Goals (explicitly out of scope for v1)

- **NG-1 No LLM/AI** anywhere in capture, calculation, or rendering. No "smart" drafting.
- **NG-2 No authentication / multi-tenant / roles.** Single-tenant by URL possession.
- **NG-3 No server-side persistence, database, or API routes.** localStorage only.
- **NG-4 No email/WhatsApp delivery, e-signatures, or client portals.** Output is a file.
- **NG-5 No invoice/tax-filing integration, no ZATCA e-invoicing (FATOORA) XML.** The
  proforma is a commercial document, not a compliance artefact.
- **NG-6 No multi-currency.** SAR only (the reference documents are SAR).
- **NG-7 No arbitrary template designer / drag-drop layout editor.** Two fixed templates.
- **NG-8 No Word (.docx) export.** PDF is the only artefact (the point is to kill the docx
  workflow).
- **NG-9 No mobile-native app; no offline PWA install.** Browser-only, desktop-first.
- **NG-10 No analytics, telemetry, or crash reporting in v1.**
- **NG-11 No i18n UI.** UI is English; the only RTL content is the single Arabic legal-name
  line in the proforma account block (rendered as a fixed RTL text run).
- **NG-12 No server-side PDF rendering / Puppeteer / Chromium.** (See 02 §5.)

## Success metric (post-launch)

Replacing the docx workflow is considered successful when the operator stops opening Word
for quotations/proformas for a full working week and reports no formatting or arithmetic
fix-ups on produced PDFs.
