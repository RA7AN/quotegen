# 05 — Acceptance Criteria (eval rubric)

Each criterion is binary pass/fail and traceable to an SRS requirement. The eval harness
(07) automates the `AC-*` items marked *(auto)*; the rest are checked by a human reviewer
against the reference PDFs.

## A. Calculation determinism

- **AC-1** *(auto, FR-4.2/4.4/4.5)* For each oracle row in 02 §4, `calc.ts` returns exactly
  the listed Total / VAT / Grand (in halalas and formatted). Any deviation = fail.
- **AC-2** *(auto, FR-4.1)* No floating-point value appears in the money path: unit tests
  assert `0.1+0.2`-style inputs (`19999.999`, `1.005`, `0.1+0.2`) round half-up to the
  expected 2dp string and never emit drift (`…00004`).
- **AC-3** *(auto, FR-4.6)* For any split set whose percents sum to 100 (in hundredths),
  the printed parts sum **exactly** to the Grand Total halalas (largest-remainder).
- **AC-4** *(auto, FR-4.7)* `formatSar` output always matches `/^\d{1,3}(,\d{3})*\.\d{2}$/`
  for values ≥ 1000 and `/^\d+\.\d{2}$/` below; never scientific notation.
- **AC-5** *(auto, FR-4.8)* Computed cells (line Price, Total, VAT, Grand, splits) are
  read-only in the DOM (`<input readOnly>` / non-editable) — a DOM test asserts no writable
  control binds to a computed value.
- **AC-6** *(auto, FR-8.3)* Rendering the same snapshot twice yields byte-identical
  extracted text and identical page counts.

## B. Wizard & capture

- **AC-7** *(FR-2.1)* The wizard exposes exactly 3 steps with the field sets in FR-2.1;
  step indicator shows `aria-current="step"` on the active step.
- **AC-8** *(FR-2.2)* Navigating 1→2→3→2→1 preserves every entered value (component test
  round-trips a filled document).
- **AC-9** *(FR-2.3)* With a required field empty/invalid, "Continue" is disabled or shows
  an inline field error; no `alert()`/`confirm()` is used anywhere (grep + test).
- **AC-10** *(FR-3.1/3.2)* Add/reorder/delete renumbers `S. No`/`Sl.No` contiguously from 1
  with no gaps/duplicates (component test over a scripted edit sequence).
- **AC-11** *(FR-3.5)* A 400-character description wraps within its cell and grows the row;
  no horizontal overflow / clipped text in the produced PDF (visual check + text-presence).
- **AC-12** *(FR-6.1)* Reloading mid-wizard restores all fields and the current step.
- **AC-13** *(FR-6.2/6.3)* Save → list → open/duplicate/delete works; a snapshot written by
  an older `schemaVersion` still opens (migration test with a v0 fixture).

## C. Output fidelity

- **AC-14** *(03 §1)* Produced PDF page size is 612×792 pt (Letter) with the specified
  margins (assert via PDF media box in the eval script).
- **AC-15** *(03 §2)* Every page carries the header band and footer band (black + gold),
  including page 2 of the quotation.
- **AC-16** *(03 §3/§4)* Section presence & order per template:
  - quotation: title strip → meta table → attn/subject → line table → totals stack
    (Total, VAT, Grand Total) → Payment Terms → [page 2] Terms & Conditions → closing →
    sign-off.
  - proforma: title strip → MODE OF PAYMENT → ACCOUNT DETAILS → line table → totals stack
    (Total after Discount, VAT, Grand Total, `<pct>% Advance`).
- **AC-17** *(03 §3.3/§4)* Column headers match exactly, in order, per template.
- **AC-18** *(auto)* Extracted PDF text contains every user-entered string verbatim
  (escaped, un-truncated) and every computed figure in `SAR X,XXX.00` form.
- **AC-19** *(human)* Side-by-side page-by-page visual diff vs the matching reference PDF
  shows no deviation outside the allowed upgrades (03 §6).
- **AC-20** *(03 §5)* Text is selectable/searchable in the produced PDF (vector, not raster).

## D. Export & naming

- **AC-21** *(FR-7.1)* "Download PDF" yields a valid PDF (`%PDF-` magic, opens in a viewer)
  in < 1.5s for a 20-line quote (NFR-2), entirely client-side.
- **AC-22** *(FR-7.3)* Filenames match the convention exactly for both templates,
  including the project-segment variant and the normalised proforma spacing.
- **AC-23** *(FR-7.4 / NG-12)* No network request is made during export (assert via a
  network-idle test / no `fetch` in the render path).

## E. Deploy & platform

- **AC-24** *(G-5 / 02 §6)* `vercel deploy` succeeds with the Next.js preset; the deployed
  URL serves the wizard; no API routes exist (`find src/app -name 'route.ts'` empty).
- **AC-25** *(NG-1/NG-12)* `package.json` contains no `puppeteer`, `playwright`, `jspdf`,
  `html2canvas`, or AI/LLM SDK (grep gate in CI).
- **AC-26** *(NFR-5)* No outbound telemetry: a network capture during a full happy path
  shows only same-origin asset loads.

## F. Safety

- **AC-27** *(FR-8.1)* A client name containing `<script>`, `&`, `"`, `'` renders as literal
  text in the PDF and does not break layout or inject markup (test + visual).
- **AC-28** *(FR-8.2)* No `Date.now()`/`Math.random()` in `src/lib`, `src/domain`, `src/pdf`
  (grep gate), so outputs are time-independent except explicit date fields.

## Sign-off rule

The build is accepted when **all `(auto)` criteria pass in CI** and a human reviewer marks
AC-19 (visual fidelity) as pass for both templates. Any single fail blocks release.
