# 08 — Milestone Backlog (post-Phase-4, generated at alpha cut)

This file records the work **remaining beyond the four build phases** (01–07 all shipped:
engine, PDF layer, wizard + storage, eval harness — see `../BUILD-TRACKER.md`). Each row is
scoped as a GitHub issue on `RA7AN/quotegen`, milestone **"Alpha hardening (post-Phase 4)"**.
This is the only Build-kit file that documents post-build scope; 01–07 remain the frozen
contract for what is already built (07 §5 regression policy applies to every item here that
touches `calc.ts`, `pdf/*` or `theme.ts`).

| # | Issue | Milestone scope | Kit anchor | Blocking release? |
|---|-------|-----------------|-----------|-------------------|
| 1 | UAT, UX improvements & review fixes/alignments | Acceptance: visual review of `src/eval/out/*.pdf` vs `Output-ref/`, HP-1..HP-4 walkthrough on the deployed Vercel URL, EC-1..EC-14 through the UI, plus collection point for UX/review fixes | 07 §3–4, 06 | **Yes** (release gate) |
| 2 | CI: automated gate suite on PR/push | Actions workflow: `tsc --noEmit` + `vitest run` + `npm run eval` + `next build` (static-export check) | 07 §2 ("CI + local script") | No (hardening) |
| 3 | Browser-level component tests (jsdom) | Wizard DOM coverage deferred by the Phase-3 pure-state tradeoff: step chips/gating, autosave + resume banner, line-editor commit rules, settings/quotes flows | 05 AC-7/8/10/12 | No (test depth) |
| 4 | Golden-file pixel regression | Rasterised HP-fixture goldens + thresholded diff in CI; `--update-goldens` requires citing a 03 §6 allowed upgrade | 07 §5 | No (regression tooling) |
| 5 | Settings: brand asset management | Logo upload/replace into a versioned `quotegen:assets:v1` envelope, resolver parity in the render path, quota-safe errors | 01 FR-5 (completeness) | No (feature gap) |
| 6 | Bank identity in defaults + proforma advisory | `bankName`/`swift` ship empty; confirm authoritative values (reference PDF + 03 §4) or amend the kit; inline Step-3 advisory when blank | 03 §4 | No (content gap) |

## Out-of-scope guardrails (unchanged from 04 §Non-Goals)

None of the six issues above may pull in an NG: no LLM/AI (NG-1), no auth/multi-tenant
(NG-2), no server persistence or API routes (NG-3, gate-checked by AC-24), no delivery/
e-sign/portal (NG-4), no ZATCA XML (NG-5), SAR only (NG-6), no template designer (NG-7),
no docx export (NG-8), no native/PWA (NG-9), no telemetry (NG-10), no UI i18n (NG-11),
no server-side rendering (NG-12). Anything beyond issues 1–6 requires a kit amendment
commit — same rule as 07 §5: reference docs, Output-ref and the kit change together.
