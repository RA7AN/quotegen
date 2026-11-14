# 09 — UAT Checklist (manual, user-run)

Run this against the **feature branch build**, not the automated harness (07). It is the
human acceptance pass: you drive the real UI in a browser and confirm behaviour and output
fidelity against `../Output-ref/`.

## 0. Environment & scope

| Item | Value |
|------|-------|
| Branch | `feat/quotegen-build` (the branch the PR was cut from) |
| App URL | **http://localhost:4560** (dev server started for you; port 4560 — not a 300x port) |
| Routes | `/` landing · `/new` wizard · `/settings` company profile · `/quotes` saved list |
| Wizard steps | 1 **Meta & client** · 2 **Line items & commercials** · 3 **Review & export** |
| Templates | **Quotation** (2-page) · **Proforma** (1-page) |
| Reference PDFs | `../Output-ref/ENCM-178-26-6824.pdf`, `ENCM-26-6879.pdf`, `PROFORMA INVOICE  5799-00 .pdf` |

> If the server is not running: `cd /Users/rayyan/Developer/Quotegen && npx next dev -p 4560`.
> To restart clean between scripts, clear site storage for `localhost:4560` (localStorage).

**How to record:** tick ☐ per step. Any ✗ → note the step ID + a screenshot; that blocks
sign-off. Trace each script to the Build-kit requirement in brackets.

---

## 1. Pre-flight — company profile `[FR-5]`

- ☐ Open `/settings`. Confirm a seeded Encompass/Elaf profile is present (names, address,
  phones, email, website, VAT `302000666700003`, C.R `4030183422`, bank, IBAN, SWIFT,
  signatory).
- ☐ Edit one field (e.g. tagline), reload, confirm it persisted (localStorage). `[FR-5.2]`
- ☐ "Reset to factory defaults" restores the original profile. `[FR-5.2]`
- ☐ Leave a required profile field blank → note whether the wizard warns or the PDF shows a
  gap. Record which.

---

## 2. HP-1 — Single-line Quotation `[FR-1..FR-8 · oracle 5,300/795/6,095]`

Mirrors `ENCM-178-26-6824`.

- ☐ `/new` loads on **Step 1**, template default = **Quotation**. `[FR-1.3, FR-2.1]`
- ☐ Enter: doc no `ENCM-178-26-6824`; quote date `17 Oct 2026`; valid until `16 Nov 2026`;
  client `THE RED SEA COASTAL VILLAGE HOTEL (DRR)`; address `Tabuk Region, North of Umluj,
  Route 55M`; Cust ID `0020TBH`; city `Al Umlaj`; CR `4701102147`; attn `Mr Mithun`;
  subject `Supply of worktop for existing Kitchen Worktable`. **Continue**.
- ☐ **Step 2**: **Add line** → description `Supply of White Marble top for work table -
  220x90x2cm and Custom made SS304 Table bottom - 220x90x90cm`; UOM `u`; qty `1`; unit price
  `5300`.
- ☐ Totals panel shows **Total 5,300.00 · VAT 795.00 · Grand 6,095.00** and the cells are
  **not editable**. `[FR-4.2/4.4/4.5/4.8 · AC-1, AC-5]`
- ☐ Payment terms: `100% advance`. **Continue** → **Step 3**.
- ☐ Preview renders **2 pages**, header + footer bands on **both**. `[AC-15]`
- ☐ **Download PDF** → file named `ENCM-178-26-6824.pdf`, opens cleanly, text selectable.
  `[FR-7.1/7.3 · AC-20, AC-22]`
- ☐ Open it beside `../Output-ref/ENCM-178-26-6824.pdf`: bands, title strip "QUOTATION",
  meta table, single line row, totals stack, Payment Terms, page-2 Terms & closing, sign-off
  — all match (differences only per 03 §6 allowed upgrades). `[AC-16, AC-17, AC-19]`

---

## 3. HP-2 — Multi-line Quotation, split payment `[oracle 74,500/11,175/85,675]`

Mirrors `ENCM-26-6879`.

- ☐ Step 1: doc no `ENCM-26-6879`; dates `25 Oct 2026` / `24 Nov 2026`; client
  `Turtle Bay Hotel (TBH)`; subject `Kidds Club Floor`.
- ☐ Step 2: two lines — (`19,500.00`, `u`, `1`) and (`1,100.00`, `m`, `50`). Totals show
  **74,500.00 / 11,175.00 / 85,675.00**. `[AC-1]`
- ☐ `S. No` column is `1`, `2` contiguous. `[FR-3.2, AC-10]`
- ☐ Payment terms two lines: `70% advance`, `30% on completion`.
- ☐ Download → `ENCM-26-6879.pdf`; matches the reference PDF visually. `[AC-19]`

---

## 4. HP-3 — Proforma, bundled lines + advance `[oracle 55,530/8,329.50/63,859.50 · 70% = 44,701.65]`

Mirrors `PROFORMA INVOICE 5799-00`.

- ☐ Step 1: template = **Proforma**; seq `5799`; client + dates.
- ☐ Step 2: three lines, each marked **included** (no unit price); descriptions as in the
  reference. Set discount so base = `55,530.00`.
- ☐ Totals: **Total after Discount 55,530.00 · VAT 8,329.50 · Grand 63,859.50**; advance
  `70%` → `44,701.65`. `[AC-1, AC-3]`
- ☐ Download → filename with normalised spacing `PROFORMA INVOICE 5799-00.pdf`. `[AC-22]`
- ☐ In the PDF: `included` prints literally in the Unit Rate/Total cells; MODE OF PAYMENT +
  ACCOUNT DETAILS block present (bank, IBAN, C.R, SWIFT) with the Arabic legal-name line
  rendering right-to-left. `[03 §4, AC-16]`

---

## 5. HP-4 — Resume + saved-quote reuse `[FR-6]`

- ☐ Fill HP-1 through Step 2, then **close the tab** (no save). Reopen `/new` → a
  **"Resume draft"** prompt appears; accept → Step 2 restored with all values. `[FR-6.1, AC-12]`
- ☐ **Save quote** as "Red Sea worktop". Go to `/quotes`; the snapshot is listed. `[FR-6.2]`
- ☐ **Duplicate** it, change only the doc-no seq, download. Confirm the original is
  unchanged and the duplicate is independent. `[AC-13]`
- ☐ Delete a snapshot; confirm it disappears and no error. `[FR-6.2]`

---

## 6. Edge cases to spot-check `[06]`

- ☐ **EC-2 rounding trap**: unit price `1.005`, qty `1` → line prints `1.01` (not `1.00`).
- ☐ **EC-1 fractional qty**: qty `0.5`, unit `199.99` → `100.00`, no float drift.
- ☐ **EC-3 split**: Grand `100.00` split `33/33/34` → parts sum exactly to `100.00`.
- ☐ **EC-5 many lines**: add 30+ lines → table paginates, header row repeats, bands repeat,
  totals stack after last row, no orphan row.
- ☐ **EC-6 long text**: a 400-char description and a very long client name wrap without
  overflow or colliding with the footer band. `[AC-11]`
- ☐ **EC-7 hostile text**: client name `<script>alert(1)</script>` and `A & B "q"` render as
  literal text; no crash, no injection. `[AC-27]`
- ☐ **EC-8 optional blanks**: leave Cust ID / City / CR / attn empty → labels omit cleanly
  (no dangling empty labels).
- ☐ **EC-10 VAT change**: set VAT to `0%` (or `5%`) → all downstream figures recompute.
- ☐ **EC-14 repeat download**: download twice without edits → identical file, same name.

---

## 7. Wizard robustness `[FR-2]`

- ☐ **Gating**: with a required Step-1 field empty, **Continue** is blocked and an inline
  field error shows; no browser `alert()`/`confirm()` popups anywhere. `[FR-2.3, AC-9]`
- ☐ **Back/forward**: navigate 1→2→3→2→1; every value is preserved. `[FR-2.2, AC-8]`
- ☐ **Reorder/delete**: move a line up/down and delete one → `S. No` renumbers contiguously.
  `[AC-10]`
- ☐ **Print** button produces the same pagination as Download. `[FR-7.2, EC-12]`

---

## 8. Deploy sanity (optional, if you point at the PR preview)

- ☐ The Vercel preview URL for `feat/quotegen-build` loads the wizard; no server errors;
  no `/api` route is hit during a full happy path (all client-side). `[AC-23, AC-24]`

---

## 9. Segmented doc number + auto-increment `[PR #26, PR #27 · AC-6, AC-9, AC-24, AC-28]`

Covers the split document-number row (prefix / project / year / seq) and the
server-computed next sequence. Run signed-in on `http://localhost:3000`.

- ☐ **Defaults**: open `/new` on a fresh draft (no Resume prompt) → Step 1 shows
  `ENCM-` · `178` · `26` · `6879`, and the composed preview reads
  `ENCM-178-26-6879`. Factory defaults appear instantly before any network call.
- ☐ **Server next-seq**: within ~1s the seq segment settles on your next number
  (one above the highest seq you have already saved for that template). If you have
  no saved quotations yet, it stays `6879`. Record the number shown.
- ☐ **Steppers**: `+`/`−` on project and seq move the value by 1; `−` at the floor
  does not go negative; leading zeros are preserved when stepping
  (e.g. `0100` → `0101`). Typing a custom value directly also sticks.
- ☐ **Custom prefix**: dropdown → `Custom…` reveals a text input; enter `PI-` and
  confirm the composed preview updates live; select `ENCM-` again to restore.
- ☐ **Year overrides**: type `2027` (or `27`) in the year segment → composes
  correctly; a 4-digit year round-trips (parses as year, not project).
- ☐ **Template switch**: flip to **Proforma** → the row becomes two segments
  (`5799` · `00`) with its own composed preview; flip back to Quotation → the four
  segments return with the last quotation values intact.
- ☐ **Auto-increment round-trip** (the core slice-2 check): note the seq shown on
  `/new` (say `N`), complete a full quote with that number and **download/save** it,
  then visit `/new` again → seq now shows `N+1` with no typing.
- ☐ **Typed-over protection**: on `/new`, immediately edit the seq before the
  server answer arrives → your typed value is kept, never overwritten.
- ☐ **Anonymous**: sign out, open `/new` → no fetch to `/api/documents/next-number`
  (check DevTools Network), factory `6879` stays. `[AC-24]`
- ☐ **Resume-draft hygiene**: visit `/new`, touch nothing, leave → returning does
  NOT prompt "Resume draft" for the untouched seeded page; the prompt only appears
  after real edits.
- ☐ **Mobile layout**: shrink to ~390 px (or open on a phone) → the four segments
  stack single-column, stepper buttons are comfortable tap targets (≥44 px), digit
  keyboard appears on tap, nothing overflows horizontally.
- ☐ **No native dialogs**: nowhere in the row/wizard does a browser
  `alert()`/`confirm()` appear; validation is inline. `[AC-9]`

---

## 10. Multi-drafts (server-backed) `[PR #29 · FR-6, AC-9, AC-12, AC-24]`

Named in-progress forms that never became a quote. Run signed-in on
`http://localhost:3000` (draft rows live in the `drafts` table, migration 0005).

- ☐ **Save draft**: on `/new`, type a client name + doc number, press **Save draft**
  in the footer → green toast `Draft “ENCM-… — …” saved.` No naming prompt. `[AC-9]`
- ☐ **Half-typed saves too**: clear the dates (invalid for export) → Save draft
  still succeeds; the draft stores what you had. Export gates stay strict.
- ☐ **Update in place**: keep editing → press **Update draft** → `/drafts` shows ONE
  refreshed row for that form (not a second copy); the toast title follows doc
  number/client changes.
- ☐ **List surfaces**: `/drafts` lists your drafts freshest-first with kind, step and
  date; `/new` shows a “Your drafts” picker (max 4 + View all); Home shows “Resume a
  draft” (max 3). All hidden when you have no drafts.
- ☐ **Open**: from `/drafts` (or a picker chip) click **Open** → the wizard lands on
  the saved step with every field restored, and the toast says `Opened draft …`;
  the local “Resume draft?” banner does NOT also appear.
- ☐ **Delete**: Delete → in-app confirm dialog (never a browser confirm) → row
  disappears, toast confirms. Reload `/drafts` — still gone.
- ☐ **Cross-device / fresh browser**: sign in elsewhere → your drafts are there
  (DB-backed, unlike the single local autosave slot). Anon visitors see no picker
  and `/new` fires no `/api/drafts` calls. `[AC-24]`
- ☐ **Stale deep link**: open `/new?draft=<deleted-id>` → fresh wizard + “could not
  be found” toast; no crash. Same with a junk id string. `[EC-11]`
- ☐ **Coexistence with autosave**: the 400 ms local “Resume draft?” slot keeps
  working independently for an interrupted tab; saving a draft does not disable it.

---

## 11. Export & chrome iteration (validity window · account menu · entity rule · share) `[PR #29 · FR-2.1, FR-7, AC-9]`

Run on `http://localhost:3000`, desktop + a mobile browser if available.

- [ ] **30-day validity window.** Step 1: set a quote date, then Valid until 29 days
  later → Continue is blocked with the inline error under Valid until; 30 days or more
  passes. A fresh wizard (seeded default = +30) sails through untouched. `[FR-2.1]`
- [ ] **Account menu.** The nav band shows one ☰ button instead of the loose email /
  theme / sign-out trio. Opening it lists the signed-in email, a Dark/Light mode row
  (flips the whole platform, survives reload), and Sign out (ends the session →
  landing). Dismisses on outside click and on Escape. `[AC-9]`
- [ ] **Entity block rule + header size.** Generate a quotation: the company name
  beside the title is bold ink with a bar rule under it, address/contact lines below
  the rule; `QUOTATION` renders at 42 pt (was 54). Edit the company address in
  Settings → the PDF block follows it (never hardcoded). Compare against
  `Output-ref/` — allowed upgrade only. `[03 §3.1, 03 §6]`
- [ ] **Share PDF.** Step 4 Export card → Share next to Download/Print.
  - Mobile (iOS Safari / Android Chrome): the native sheet opens with
    Mail / WhatsApp / Messages etc.; the PDF arrives as a real attachment with the
    filename from `filenameFor`. Dismissing the sheet says "Share dismissed", no
    error. `[FR-7]`
  - Desktop without file sharing (Safari, Firefox): status explains it downloaded
    instead; the file matches Download PDF exactly (same blob + events).
  - Shared and fallback paths both appear in the KPI tiles ('exported'; the
    fallback also logs the document row like a plain Download does). `[#10]`

---

## 12. Sign-off

| Script | Result (Pass/Fail) | Notes / screenshot |
|--------|--------------------|--------------------|
| 1 Pre-flight | | |
| HP-1 Quotation single | | |
| HP-2 Quotation multi | | |
| HP-3 Proforma | | |
| HP-4 Resume + saved | | |
| Edge cases | | |
| Wizard robustness | | |
| Fidelity vs Output-ref | | |
| 9 Segmented doc number | | |
| 10 Multi-drafts | | |
| 11 Export & chrome iteration | | |

**Accepted for merge when:** all HP scripts pass, no blocking edge-case failure, and the
fidelity comparison shows only allowed-upgrade differences (03 §6). Any ✗ blocks sign-off —
log it against the referenced `[FR/AC]` ID.
