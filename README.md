# Quotegen

Deterministic web quote/proforma builder. Produces a client-ready **Quotation** or
**Proforma Invoice** PDF in minutes — zero manual formatting, zero manual arithmetic.

Built strictly against the contract in [`Build-kit/`](./Build-kit). The produced PDF is a
1:1 clone of the reference documents in [`Output-ref/`](./Output-ref) (modulo the small
allowed upgrades listed in `Build-kit/03-template-fidelity.md §6`).

## Core invariants

- **Deterministic**: same inputs ⇒ identical numbers and byte-stable layout.
- **No manual math**: all totals, VAT and payment splits are computed from integer halalas.
- **Vercel-deployable, zero native binaries**: pure client-side, `@react-pdf/renderer`.

## Evaluation

`npm run eval` runs the offline automated harness from `Build-kit/07` against the fixtures
in `src/eval/fixtures/` — the calc oracle, render/geometry/verbatim gates, the double-render
determinism gate, and the static grep gates (banned deps, no clock/random in the render path,
no API routes, no `alert`/`confirm`) — then the Vitest unit suite. Exit 0 means every
automated AC passed; rendered PDFs land in `src/eval/out/` for the human visual review.

## Deploy

Static export only: `next build` emits `out/` with `output: 'export'` and no server
functions (AC-24). Deploy the `out/` directory to Vercel (or any static host); there is no
backend, so no env or API secrets are required.

## Status

Phases 1–4 complete (deterministic engine, PDF renderer, wizard + storage, eval harness).
See [`BUILD-TRACKER.md`](./BUILD-TRACKER.md) for progress against the spec.

> `Build-kit/` and `Output-ref/` are read-only inputs and are never modified by the app.
