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

## Status

Early build. See [`BUILD-TRACKER.md`](./BUILD-TRACKER.md) for progress against the spec.

> `Build-kit/` and `Output-ref/` are read-only inputs and are never modified by the app.
