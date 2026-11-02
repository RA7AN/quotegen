# 03 — Template Fidelity Specification (1:1 clone)

This doc is the pixel/structure contract. Ground truth = the four files in
`../Output-ref/`. Where the DOCX and a PDF disagree, the **DOCX wins for structure**
(tables, page geometry) and the **PDFs win for filled-data appearance**.

## 1. Page geometry (both templates)

Source: `ENCM-26-6879.docx` `<w:sectPr>` and the PDFs' media box (612×792 pt).

| Property | Value |
|----------|-------|
| Page size | **US Letter**, 8.5in × 11in = **612 × 792 pt** |
| Margin top | 2448 twips = 1.7in = **122.4 pt** |
| Margin left / right | 1440 twips = 1in = **72 pt** |
| Margin bottom | 1440 twips = 1in = **72 pt** |
| Header / footer offset | 720 twips = 0.5in = 36 pt |

`@react-pdf` `<Page size="LETTER" margin={{top:122.4, left:72, right:72, bottom:72}}>` with
the brand bands drawn in a `<Fixed>` header/footer item so they repeat on every page.

> Note: Letter (not A4) is deliberate — it matches every reference artefact. Expose an
> optional `pageSize: 'LETTER'|'A4'` config defaulting to `LETTER`.

## 2. Brand bands (rebuild as vector; do NOT paste the raster letterhead)

The DOCX embeds full-page raster letterheads (`word/media/image2.jpeg`, `image3.png`).
Pasting them would bake in a logo variant and blur on scale. Instead **rebuild** the bands
as vector and reuse only the cropped **logo marks** as images.

### 2.1 Header band (top of every page)
- Full-bleed **black** (`#000000`) horizontal band, ~0.9in tall, spanning the full page
  width edge-to-edge (ignore side margins).
- Left: a **chevron motif** — 4–5 nested right-pointing chevrons in white/grey, bleeding
  off the left edge. Rebuild as inline SVG (`public/brand/chevrons.svg`).
- Centre-left: company name in **white, bold, uppercase, ~20pt**, two lines
  ("ENCOMPASS DESIGN AND" / "BUILD"); beneath it the tagline in lighter grey-white
  ~9pt letter-spaced uppercase: "BUILDING DREAMS, ONE AT A TIME".
- Right: the **header logo mark** (white line-art monogram) — crop from
  `word/media/image2.jpeg` → `public/brand/header-mark.png`, ~0.7in tall, right-aligned
  with ~0.4in inset.
- Directly below the band: a thin **gold rule** (~1.5pt) spanning the text width,
  dark→gold left-to-right gradient.

### 2.2 Footer band (bottom of every page)
- **Black** band ~0.85in tall, full text width (inset to margins, not edge-to-edge).
  - Left: **footer logo mark** (ELAF / الإمامة lockup) — crop from `image3.png` →
    `public/brand/footer-mark.png`.
  - Middle: "**Address**" bold label + address lines (white, ~9pt).
  - Right: "**Contact**" bold label + phones, then email (white, ~9pt).
- Below it, a **gold gradient band** ~0.22in tall, full text width, white uppercase ~8pt
  text, four segments separated by wide gaps:
  `WWW.ENCOMPASSGROUPSA.COM` · `VAT: 302000666700003` ·
  `AC: SA 50 6500 0000 2354 1754 8001` · `C.R: 4030183422`.

### 2.3 Colour tokens (sample exactly at build time)
Sample and freeze these in `src/pdf/theme.ts`; approximate starting values:
`ink #000000`, `muted #7D7D7D`, `band #000000`, `goldDark ≈ #4A3608`,
`gold ≈ #A8842C`, `goldLight ≈ #C9A227`, `paper #FFFFFF`.
The two greys actually present in the DOCX text are `#000000` and `#7D7D7D` — use exactly
those for body vs secondary text.

## 3. Template A — `quotation` (2-page shape)

### 3.1 Title strip (page 1, under header band)
- Left: the word **"QUOTATION"** in very large (~54pt) black bold sans, tight tracking.
- Right (same row, right-aligned, `#7D7D7D`, ~9pt): issuing-entity block —
  legal name, address lines, phones, website, `VAT: …`, `C.R: …`.
- (This is `word/media/image1.png` in the source; rebuild as live text so it stays crisp
  and editable via Settings.)

### 3.2 Meta table (borderless 2-column grid)
| Left cell | Right cell |
|-----------|-----------|
| `Quotation #:` **value** | `Valid Until:` **value** |
| `Quotation Date:` **value** | *(empty)* |
| `Client:` merged full-width block: name (bold), address lines, `Cust ID:`, `City:`, `CR No.:` | |

Labels in `#7D7D7D` ~9pt; values in `#000000` ~10pt bold where the source bolds them.
Then the attention/subject prose: `Attn. <attn>,` newline
`Kindly find the attached quotation for <subject>.`

### 3.3 Line-items table
Header row (bold, shaded light-grey, centred): `S. No | Description | Unit Price (SAR) |
UOM | Quantity | Price (SAR)`.
- `S. No`, `UOM`, `Quantity` centred; `Description` left; money columns right-aligned.
- Body rows: thin horizontal rules; description wraps to multiple lines (row grows).
- Money cells render as `SAR 5,300.00` in the **Price** column; the **Unit Price** column
  renders the bare number `5300`/`19,500.00` exactly as keyed (see reference: Q-6824 shows
  `5300`, Q-6879 shows `19,500.00`). **Normalise both to 2dp** as the conscious upgrade.

### 3.4 Totals stack (right-aligned under the table)
Three rows, each with the label merged across the first five columns (right-aligned, bold)
and the value in the last column as `SAR  X,XXX.00`:
`Total`, `VAT`, `Grand Total`. The `Grand Total` row is emphasised (bold + light shade).

### 3.5 Payment terms (page 1)
Heading `Payment Terms` (bold) then one free-text line per entry
(e.g. `100% advance`, or `70% advance` + `30% on completion`).

### 3.6 Page 2 — Terms & closing
- Heading `Terms & Conditions` (bold).
- Numbered clauses `1.` `2.` `3.` …; default seeded clauses:
  1. `Validity: This quotation is valid for 30 days from the date of issue.`
  2. `Execution Time: <…>` (editable; e.g. `Estimated Collection (Jeddah) within 10 days from PO and Advance Payment`)
  3. `Scope Variation Clause: Adding or cancelling any item(s) or scope of works covered in the BOQ may result in adjustment of unit rates of other related items, except for items explicitly quoted as optional.`
- Closing paragraph: `We trust this quotation meets your requirements and look forward to
  your positive response. For further clarifications, please feel free to contact us.`
- Sign-off block: `Best regards,` / name / org / `Mob: …` / email / website.
- Page 2 carries the same header + footer bands (Fixed items).

## 4. Template B — `proforma` (1-page shape)

- Header band identical (§2.1). Title strip word = **"PROFORMA INVOICE"** (same treatment
  as §3.1) with the same right-hand entity block.
- `MODE OF PAYMENT: BANK TRANSFER` (bold label + value).
- `ACCOUNT DETAILS` block: `BANK NAME:` value; Arabic legal-name line (right-to-left run,
  rendered as a single RTL text node); `IBAN:` value; `C.R:` value; `SWIFT - <code>`.
- Line-items table header: `Sl.No | Description | Unit | Qty | Unit Rate (SAR) | Total (SAR)`.
  - Bundled/`included` lines: the Unit Rate and Total cells print the literal word
    `included` (centred) instead of a number — support a per-line `pricing: 'rated'|'included'`.
- Totals stack: `Total after Discount`, `VAT`, `Grand Total`, then an extra row
  `<pct>% Advance` with its computed value (e.g. `70% Advance  SAR 44,701.65`).
- Footer band identical (§2.2).

## 5. Fonts

The source mixes Arimo / Arimo Bold / Open Sans / Verdana / Calibri / "Heading Now".
Bundle and register (see 02 §5): **Arimo** (body + bold) as the primary face — it is the
dominant face and metric-compatible with Arial — and **Open Sans** for the band/tagline
uppercase. Record the mapping in `theme.ts`:
`body=Arimo`, `bold=Arimo Bold`, `display(QUOTATION word)=Arimo Bold`, `band=Open Sans`.

## 6. Allowed conscious aesthetic upgrades (the only permitted deviations)

1. Vector-rebuilt bands/chevrons/log-rule instead of raster letterhead (crisper).
2. Title-strip entity block and meta values as live text instead of a baked image.
3. Unit-price column normalised to 2dp (`5300` → `5,300.00`).
4. Slightly larger line-height (~1.35) inside wrapping description cells.
5. Right-aligned tabular figures for all money columns.
6. A hairline zebra tint on alternating line-item rows **only if** it does not clash with
   the reference's plain rules (default: off).

Anything not on this list must match the reference exactly. Reviewers diff against the
reference PDFs page-by-page.
