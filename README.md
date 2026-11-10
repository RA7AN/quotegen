# Quotegen

[![CI](https://github.com/RA7AN/quotegen/actions/workflows/ci.yml/badge.svg)](https://github.com/RA7AN/quotegen/actions/workflows/ci.yml)

Deterministic web quote/proforma builder. Produces a client-ready **Quotation** or
**Proforma Invoice** PDF in minutes — zero manual formatting, zero manual arithmetic.

Built strictly against the contract in [`Build-kit/`](./Build-kit). The produced PDF is a
1:1 clone of the reference documents in [`Output-ref/`](./Output-ref) (modulo the small
allowed upgrades listed in `Build-kit/03-template-fidelity.md §6`).

## Core invariants

- **Deterministic**: same inputs ⇒ identical numbers and byte-stable layout.
- **No manual math**: all totals, VAT and payment splits are computed from integer halalas.
- **Vercel-deployable, zero native binaries**: the PDF/calculation core (`src/lib|domain|pdf`) stays pure client-side `@react-pdf/renderer`; a thin server layer (`src/db`, `src/app/api`, `src/auth`) is kept isolated from it (AC-24).

## Evaluation

`npm run eval` runs the offline automated harness from `Build-kit/07` against the fixtures
in `src/eval/fixtures/` — the calc oracle, render/geometry/verbatim gates, the double-render
determinism gate, and the static grep gates (banned deps, no clock/random in the render path,
server code confined to the api/db/auth boundary, no `alert`/`confirm`) — then the Vitest unit suite. Exit 0 means every
automated AC passed; rendered PDFs land in `src/eval/out/` for the human visual review.

## Deploy

Serverful Next.js on Vercel (since issue #13). `next build` runs on the Node server runtime;
the data layer uses **Neon Postgres** via **Drizzle** (`src/db`) and SQL migrations in `drizzle/`
are part of the repo. Auth is **Better Auth** (`src/auth`, mounted at `/api/auth/[...all]`) with
**email + password** and password recovery over **Resend** SMTP (issue #9). Set these in the
Vercel project (see `.env.example`): pooled `DATABASE_URL`, `BETTER_AUTH_SECRET` (generate via
`npx @better-auth/cli secret`), `BETTER_AUTH_URL` (the deployment URL), and
`RESEND_API_KEY` + `EMAIL_FROM` (verify the sender domain's SPF/DKIM in Resend). Apply schema
with `npm run db:migrate` (creates the feature + Better Auth tables). All auth/DB code is
placeholder-guarded (`REPLACE_ME`), so the app builds and runs before creds land. The wizard and
PDF generation remain client-side, so the deterministic output is unchanged.

## Status

Phases 1–4 complete (deterministic engine, PDF renderer, wizard + storage, eval harness).
Groundwork #13 landed: serverful build + Neon/Drizzle data layer + auth seam. #9 landed:
Better Auth (email/password + password recovery via Resend), auth tables + migration, the
`/api/auth` handler and the sign-in/up/forgot/reset pages. #10–#12 build on the
`requireSessionUser` guard. See [`BUILD-TRACKER.md`](./BUILD-TRACKER.md) for progress against the spec.

> `Build-kit/` and `Output-ref/` are read-only inputs and are never modified by the app.
