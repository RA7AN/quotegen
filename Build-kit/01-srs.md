# 01 — Software Requirements Specification (SRS)

## 1. Purpose

Quotegen is a single-purpose web application, deployed on Vercel and reached by URL, whose
sole job is to let a user produce a client-ready **Quotation** or **Proforma Invoice** PDF in
minutes, with zero manual formatting, zero manual arithmetic, and zero typo surface. It
replaces the current workflow of hand-editing a `.docx` and exporting to PDF.

The produced PDF must be a **1:1 clone** of the reference documents in `../Output-ref/`
(see [03-template-fidelity.md](./03-template-fidelity.md)), allowing only the small,
conscious aesthetic upgrades listed in that doc.

## 2. Users & context

- **Primary user**: an internal sales/estimating operator at the issuing company
  (Encompass Design and Build / Elaf Al Yamamah Metal Services Co.). Single-tenant. The user
  is authenticated only by possession of the URL (see non-goals: no auth in v1).
- **Secondary consumer**: the client who receives the PDF. They see only the artefact.
- **Environment**: desktop browser (Chrome/Edge/Safari latest). Mobile is a read/fill
  convenience, not a layout target for the PDF.

## 3. Scope

In scope: two document templates (Quotation, Proforma Invoice); a guided wizard; a
deterministic calculation engine; company profile/branding configuration; localStorage
drafts & saved quotes; one-click PDF export; print stylesheet fallback.

Out of scope: see [04-goals-and-non-goals.md](./04-goals-and-non-goals.md).

## 4. Functional requirements

IDs are stable and referenced by the acceptance criteria (05) and eval plan (07).

### FR-1 Document templates
- FR-1.1 Provide template `quotation` (2-page shape) and template `proforma` (1-page shape),
  matching the reference outputs.
- FR-1.2 Each template is a pure renderer over a typed input object; no I/O, no clock, no
  randomness inside the renderer.
- FR-1.3 Template choice is explicit (user picks) with a sensible default (`quotation`).

### FR-2 Wizard (guided capture)
- FR-2.1 Three steps, mirroring the offer-letter wizard pattern:
  - **Step 1 — Meta & client**: document number, quotation date, valid-until date, client
    block (name, address lines, Cust ID, city, CR No.), attention line, subject line
    ("Kindly find the attached quotation for …").
  - **Step 2 — Line items & commercials**: repeatable line items (description, UOM,
    quantity, unit price); optional discount (proforma); VAT rate (default 15%); payment
    terms (free-text lines for quotation; percent splits for proforma advance).
  - **Step 3 — Review & export**: read-only rendered preview + inline click-to-edit of
    free-text prose + one-click Download PDF + Print.
- FR-2.2 Back/forward navigation preserves all entered state; returning to a step shows
  prior values.
- FR-2.3 Step gating: cannot advance past a step whose required fields are invalid; show
  inline, field-level validation messages (no modals, no alerts).

### FR-3 Line items
- FR-3.1 Add / edit / reorder (up-down) / delete line items.
- FR-3.2 Auto-number `S. No` / `Sl.No` sequentially from 1; renumber on reorder/delete.
- FR-3.3 Per-line `Price = unitPrice × quantity`, computed in integer halalas.
- FR-3.4 UOM is a free-text short code with common defaults offered (`u`, `m`, `No`, `Ls`,
  `m²`, `set`).
- FR-3.5 Multi-line descriptions wrap inside the cell (no truncation, no overflow).

### FR-4 Calculation engine (deterministic)
- FR-4.1 All money stored/computed as **integer halalas** (1 SAR = 100 halalas). No floats
  in the money path.
- FR-4.2 `Total = Σ line.Price`.
- FR-4.3 `Discount` (proforma only) entered as amount or percent; `Total after Discount =
  Total − discount`.
- FR-4.4 `VAT = roundHalfUp(base × vatRate)`, `vatRate` default 1500 basis-points (15%),
  configurable per document.
- FR-4.5 `Grand Total = base + VAT`.
- FR-4.6 Payment splits (e.g. `70% Advance`) computed by **integer-hundredths +
  largest-remainder** so the printed parts always sum exactly to the Grand Total
  (mirror of `salary-breakdown.ts`).
- FR-4.7 Display formatting: thousands separators, exactly 2 decimals
  (`SAR 5,300.00`); never scientific notation; never floating drift (`0.30000000000004`).
- FR-4.8 The user can never type or override a computed total; computed cells are
  read-only in the UI.

### FR-5 Company profile & branding (settings)
- FR-5.1 A Settings screen captures the issuing-company profile once: legal names (EN +
  optional AR), tagline, address, contacts, email, website, VAT number, C.R., bank name,
  IBAN/AC, SWIFT, signatory name/title/mobile, logo marks.
- FR-5.2 Profile persists to `localStorage`; a "reset to factory defaults" action restores
  the seeded Encompass/Elaf profile.
- FR-5.3 Brand band colours and logo marks are sourced per
  [03-template-fidelity.md](./03-template-fidelity.md) and bundled as static assets.
- FR-5.4 First-run onboarding (#37): a signed-in account that has not yet configured its
  company profile is guided through a one-time, step-by-step setup wizard (`/onboarding`) that
  reuses the same profile fields and brand-mark guards as Settings. It finishes (or is skipped,
  accepting the factory defaults) with a single save that persists the profile and records a
  server-side `setupComplete` marker; the authenticated app shell gates entry to the document
  wizard until that marker is set, so the setup follows the account across devices. Settings
  exposes a "Run setup again" entry to re-enter the wizard.
- FR-5.5 Company-profile library + per-quote picker (#31 part 1): a signed-in account can keep
  several named company profiles (letterheads). Settings exposes a "My profiles" manager to save
  the current profile as a new row, rename, promote one to the account default, delete, and edit
  any row by id (the editor binds to the default on open; saves write that row). The wizard shows
  a profile picker on the Meta step and the Review step to render the *current* quote from any
  saved profile without changing the account default; the chosen row id persists per draft (its own
  `localStorage` slot) and re-resolves on reload, self-clearing if the row was deleted. The export
  snapshots the full resolved profile, so previously generated documents stay deterministic. The
  active/default profile remains the singular `/api/profile` read used by onboarding; the library
  is served by plural `/api/profiles` endpoints over the same `profiles` table (no migration).
- FR-5.6 Uploaded brand marks render in the PDF banner (#36): while a mark is uploaded in Settings
  it is stored and previewed, but the banner keeps rendering the baked-in Encompass crops, so the
  output never changes. With this feature, when an **uploaded** (data-URL) mark resolves for a
  position, the header renders a logo-neutral band crop (identical artwork, logo region cleared) and
  the mark is placed in its reserved slot; the footer mark sits just above the info strip. The
  override signal arrives fully resolved through `PdfInput.assets` (`src/pdf` never reads storage,
  AC-24/28), and the placed mark keeps its intrinsic aspect (contain, never stretched). With no
  upload the baked banner renders unchanged, so the HP goldens stay 0 px (AC-6/EC-14); resetting a
  mark reverts the PDF to the baked banner.
- FR-5.7 Product identity in the browser (#47): the app serves its own icon (a gold `Q` monogram on the
  brand black, from `--color-gold-light`) as the tab favicon and home-screen icon, using the App
  Router file convention (`src/app/icon.svg` + `icon.png` + `apple-icon.png`) so the link tags are
  emitted from the root layout without hand-written HTML. This is the *product's* mark and is
  deliberately separate from FR-5.5/5.6: it never enters the PDF and is not user-editable.

### FR-6 Drafts & saved quotes
- FR-6.1 Autosave the in-progress wizard to `localStorage` on every change (debounced);
  restore on reload ("resume where you left off").
- FR-6.2 "Save quote" stores a named snapshot to `localStorage`; a list view opens,
  duplicates, or deletes snapshots.
- FR-6.3 Snapshots are versioned (`schemaVersion`) so future field additions migrate
  without corrupting old drafts.

### FR-7 Export
- FR-7.1 `Download PDF` produces the final vector PDF (selectable text), page size and
  margins per the fidelity spec, filename per FR-7.3.
- FR-7.2 `Print` opens the browser print dialog with an `@page`-accurate stylesheet that
  reproduces the same layout (fallback path).
- FR-7.3 Filename convention:
  - Quotation → `ENCM-<YY>-<SEQ>.pdf` (e.g. `ENCM-26-6879.pdf`); with project segment when
    present → `ENCM-<PROJ>-<YY>-<SEQ>.pdf` (e.g. `ENCM-178-26-6824.pdf`).
  - Proforma → `PROFORMA INVOICE  <SEQ>-<CENTS>.pdf` mirroring the reference
    (`PROFORMA INVOICE  5799-00 .pdf`), normalised to a single space and trimmed.
- FR-7.4 Export is client-side (no server round-trip), so it works on Vercel with no
  native binaries.
- FR-7.5 Preview stability (#46): the Step-4 review preview renders the same document as the
  export path and must keep the loaded artifact — and the reader's position inside it — while unrelated UI
  state changes (typing in the export panel, a toast auto-dismissing, an export spinner flipping).
  The PDF re-renders only when the render input actually changes, so the viewer never reloads to
  page 1 mid-read.

### FR-8 Determinism & safety
- FR-8.1 Every user-controllable string is HTML/PDF-escaped before rendering
  (escape-then-substitute, per `render.ts`).
- FR-8.2 No `Date.now()`/random in the render path; dates come only from explicit fields.
- FR-8.3 Rendering the same snapshot twice yields identical numbers and identical
  pagination.

## 5. Data model (logical)

```
CompanyProfile   { legalNameEn, legalNameAr?, tagline, addressLines[], phone[], mobile,
                   email, website, vatNo, crNo, bankName, iban, swift,
                   signatory{name,title,mobile,email}, logos{headerMark,footerMark} }

QuoteDocument    { schemaVersion, template: 'quotation'|'proforma',
                   meta{ docNo, projectSegment?, quoteDateISO, validUntilISO,
                         subject, attn },
                   client{ name, addressLines[], custId, city, crNo },
                   lines[]: { id, description, uom, qty(int hundredths), unitPriceHalalas },
                   commercials{ discountMode:'none'|'amount'|'percent', discountValue,
                                vatBps (default 1500),
                                paymentTermsText[] (quotation),
                                advanceSplits[]:{label,percentHundredths} (proforma) },
                   terms{ clauses[] } ,
                   closing{ signoff, name, org, mobile, email, website } }
```

`qty` is stored as integer hundredths so fractional quantities (`0.5 m`) are exact.

## 6. Workflows (summary)

See [06-happy-paths-and-edge-cases.md](./06-happy-paths-and-edge-cases.md) for the full
step-by-step happy paths (HP-1…HP-4) and edge cases (EC-1…).

## 7. Non-functional requirements

- NFR-1 First interactive paint < 2s on a mid-range laptop over broadband.
- NFR-2 PDF generation for a 20-line quote < 1.5s client-side.
- NFR-3 Works fully client-side; the deployed Vercel app serves static/SSR pages only.
- NFR-4 Accessible: labelled inputs, keyboard-navigable wizard, `aria-current` on steps.
- NFR-5 No PII leaves the browser (everything is localStorage); no analytics in v1.
- NFR-6 **Phone browser is the primary device.** Every primary flow (sign in, wizard, save/export,
  lists, settings) must be usable in a 360–430 px wide viewport:
  - touch targets ≥ 44 × 44 px for anything in the app chrome, a list row or a dialog;
  - no horizontal overflow — `documentElement.scrollWidth` equals the layout viewport width;
  - overlays are bottom sheets on phones, capped at 80 svh and scrollable inside themselves, with the
    background page scroll-locked and Tab focus trapped; the safe (non-destructive) action holds
    initial focus;
  - navigation survives without a wrapping header row (fixed bottom tab bar, `aria-current="page"`),
    and chrome clears the device safe area (`viewport-fit=cover` + `env(safe-area-inset-*)`);
  - no viewport-sourced zoom on focus and no font scaling that breaks layout
    (`text-size-adjust: 100%`, pinch-zoom stays enabled);
  - viewport-relative heights use `dvh`/`svh`, never `100vh` (the mobile *large* viewport counts the
    URL bar, which guarantees phantom scroll);
  - **forms (added for #50)**: every text-entry control is ≥ 16 px so focusing never triggers the iOS
    zoom, and ≥ 44 px tall; the primary action of a long form (wizard Continue, settings Save) stays
    reachable via a sticky bar, an invalid submit brings the first offending field into view and focuses
    it, the Step-4 preview fills the viewport rather than a fixed-height iframe, and no delete control
    sits adjacent to a reorder/insert control.
  Measured with the 390 × 844 audit harness; see AC-29…AC-34 and HP-9/HP-10, EC-20/EC-21.
  (Added for issue #49; the forms clause is #50.)
