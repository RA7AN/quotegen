# 06 — Happy Paths & Edge Cases

Happy paths are the scripted journeys the eval harness replays (07) and the reviewer walks
manually. Each ends in a downloaded PDF.

## HP-1 — First-time quotation, single line (mirrors ENCM-178-26-6824)

1. Open URL → lands on `/new`, wizard step 1, template preselected `quotation`.
2. Step 1: enter doc no `ENCM-178-26-6824`, quote date `2026-10-17`, valid until
   `2026-11-16`; client name `THE RED SEA COASTAL VILLAGE HOTEL (DRR)`, address lines,
   Cust ID `0020TBH`, city `Al Umlaj`, CR `4701102147`; attn `Mr Mithun`; subject
   `Supply of worktop for existing Kitchen Worktable`. Continue.
3. Step 2: add one line — description `Supply of White Marble top for work table -
   220x90x2cm and Custom made SS304 Table bottom - 220x90x90cm`, UOM `u`, qty `1`,
   unit price `5300`. Observe live totals: Total `5,300.00`, VAT `795.00`, Grand
   `6,095.00` (read-only). Payment terms: `100% advance`. Continue.
4. Step 3: preview shows 2 pages with bands; click **Download PDF** →
   `ENCM-178-26-6824.pdf`.
5. **Expected**: numbers match oracle; layout matches reference page-by-page.

## HP-2 — Multi-line quotation with split payment (mirrors ENCM-26-6879)

1. Step 1 as above with doc no `ENCM-26-6879`, dates `2026-10-25` / `2026-11-24`, client
   `Turtle Bay Hotel (TBH)`, subject `Kidds Club Floor`.
2. Step 2: two lines — (`19,500.00`, `u`, `1`) and (`1,100.00`, `m`, `50`). Totals:
   `74,500.00` / `11,175.00` / `85,675.00`. Payment terms two lines: `70% advance`,
   `30% on completion`.
3. Step 3 → Download → `ENCM-26-6879.pdf`. **Expected** totals match oracle exactly.

## HP-3 — Proforma invoice with bundled lines + advance (mirrors PROFORMA 5799-00)

1. Step 1: template = `proforma`; doc no seq `5799`; client + dates.
2. Step 2: three lines all `pricing: included` (descriptions as in the reference); set
   discount so base = `55,530.00`; VAT 15% → `8,329.50`; Grand `63,859.50`; advance split
   `70%` → `44,701.65`.
3. Step 3 → Download → `PROFORMA INVOICE 5799-00.pdf` (normalised spacing).
4. **Expected**: `included` cells print the literal word; account-details block present
   with bank/IBAN/CR/SWIFT and the Arabic legal-name line.

## HP-4 — Interrupted session resume + saved-quote reuse

1. Fill HP-1 through step 2, close the tab (no explicit save).
2. Reopen URL → banner "Resume draft?" → accept → wizard restores step 2 with all values.
3. **Save quote** as "Red Sea worktop". Navigate to `/quotes`, open it, **Duplicate**,
   change only the doc-no seq, download. **Expected**: duplicate is independent; original
   unchanged.

---

## Edge cases (must not break determinism or layout)

- **EC-1 Fractional qty**: qty `0.5`, unit `199.99` → line price `100.00` (round half-up),
  no float drift.
- **EC-2 Rounding trap**: unit `1.005`, qty `1` → `1.01` (half-up), never `1.00`.
- **EC-3 Split that doesn't divide evenly**: Grand `100.00` split 33/33/34 → parts sum to
  exactly `100.00` (largest-remainder), e.g. `33.00/33.00/34.00`.
- **EC-4 Zero-quantity / zero-price line**: allowed, prints `0.00`; never NaN/blank.
- **EC-5 Many lines (30+)**: table paginates across pages; header row repeats; bands repeat;
  totals stack lands after the last line row; no orphaned single row.
- **EC-6 Very long description / long client name**: wraps, grows row/cell, never overflows
  the page width or collides with the footer band.
- **EC-7 Hostile text**: `<script>alert(1)</script>`, `A & B`, `"quotes"`, emoji — renders
  as literal text; no injection; no crash.
- **EC-8 Empty optional fields**: blank Cust ID / City / CR / attn omit cleanly (no
  `Cust ID:` label with nothing after it, or label suppressed per reference behaviour).
- **EC-9 Discount = 0 / none**: proforma totals stack shows `Total after Discount` equal to
  Total; quotation omits discount entirely.
- **EC-10 VAT rate changed** (e.g. 0 or 5%): all downstream figures recompute; oracle test
  covers 15% only but engine must honour the configured bps.
- **EC-11 Corrupt/old localStorage draft**: app falls back to a blank wizard with a notice,
  never white-screens.
- **EC-12 Print fallback**: invoking Print produces the same pagination as Download.
- **EC-13 Browser zoom / small window**: wizard UI reflows; the PDF geometry is unaffected
  (it is fixed-pt, not CSS-px).
- **EC-14 Repeated downloads**: two consecutive downloads of an unchanged doc are identical
  (byte-stable text layer) and both use the same filename.
