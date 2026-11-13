/**
 * pdf/primitives.tsx — shared, pure @react-pdf building blocks (Build-kit/03 §2-§4).
 *
 * Bands are rebuilt as VECTOR (black rect + rotated-square chevrons + gold rule), never
 * the raster letterhead (allowed upgrade #1). Only the cropped logo marks are images.
 * Every component is a pure function of its props: no clock, no random, no network.
 */

import { StyleSheet, View, Text, Image } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import { COLORS, FONTS, LINE_COLUMNS, PAGE } from './theme';
import { formatSar, formatSarPrefixed } from '@/lib/money';
import { parseInline } from '@/lib/inline';
import type { ComputedTotals } from '@/domain/calc';
import type { CompanyProfile, LineItem } from '@/domain/types';

export type PdfAssets = {
  headerMark: string;
  footerMark: string;
  headerBand: string;
  footerStrip: string;
  footerStripProforma: string;
};

export const styles = StyleSheet.create({
  // ---- header band (edge-to-edge, 03 §2.1) ----
  // The reference header is a single full-width raster strip (PDF xref 10, 612×124.8pt:
  // black band + chevrons + two-line name + tagline + tower logo + gold rule, all baked
  // in). We clone it 1:1 with that graphic instead of a vector approximation, matching
  // how the source document is actually built (its header carries no selectable text).
  headerFixed: { position: 'absolute', top: 0, left: 0, width: PAGE.widthPt },
  headerBandImg: { width: PAGE.widthPt, height: 125 },

  // ---- footer strip (03 §2.4) ----
  // The reference footer is a single full-width gold/black info strip (WWW · VAT · AC · CR
  // baked into the graphic), sitting a little above the page bottom edge — no black address
  // band (that lives in the entity/signoff blocks). Quotation strip is 14.7pt tall at 34pt
  // from the bottom; the proforma strip is taller (25.5pt at 25pt).
  footerFixed: { position: 'absolute', bottom: 34, left: 0, width: PAGE.widthPt },
  footerStrip: { width: PAGE.widthPt, height: 14.7 },
  footerFixedPro: { position: 'absolute', bottom: 25, left: 0, width: PAGE.widthPt },
  footerStripPro: { width: PAGE.widthPt, height: 25.5 },

  // ---- title strip (03 §3.1) ----
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  titleWord: {
    fontFamily: FONTS.display,
    fontWeight: 700,
    fontSize: 54,
    letterSpacing: -0.5,
    color: COLORS.ink,
    lineHeight: 1,
  },
  entityBlock: { flex: 1, alignItems: 'flex-end', marginTop: 6 },
  entityLine: { fontFamily: FONTS.body, fontSize: 9, color: COLORS.muted, lineHeight: 1.35, textAlign: 'right' },

  // ---- meta table (03 §3.2) ----
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  metaCell: { width: '50%', marginBottom: 3 },
  metaFull: { width: '100%', marginBottom: 3 },
  metaLabel: { fontFamily: FONTS.body, fontSize: 9, color: COLORS.muted },
  metaValue: { fontFamily: FONTS.body, fontWeight: 700, fontSize: 10, color: COLORS.ink },
  metaValuePlain: { fontFamily: FONTS.body, fontSize: 10, color: COLORS.ink },
  prose: { fontFamily: FONTS.body, fontSize: 10, color: COLORS.ink, lineHeight: 1.4, marginBottom: 10 },

  // ---- line-items table (03 §3.3 / §4) ----
  tableHeader: { flexDirection: 'row', backgroundColor: COLORS.ink, borderBottomWidth: 1, borderBottomColor: COLORS.ink },
  th: { fontFamily: FONTS.body, fontWeight: 700, fontSize: 9, color: COLORS.paper, paddingVertical: 5, paddingHorizontal: 4 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#BBBBBB', paddingVertical: 4 },
  rowAlt: { backgroundColor: COLORS.zebraTint },
  cell: { fontFamily: FONTS.body, fontSize: 9, color: COLORS.ink, paddingHorizontal: 4, lineHeight: 1.35 },
  cellCenter: { textAlign: 'center' },
  cellRight: { textAlign: 'right' },

  // ---- totals stack (03 §3.4) ----
  totalsWrap: { marginTop: 8 },
  totalsRow: { flexDirection: 'row', paddingVertical: 3 },
  totalsRowEmph: { backgroundColor: COLORS.headerShade, paddingVertical: 4 },
  totalsLabel: { flex: 1, textAlign: 'right', fontFamily: FONTS.body, fontWeight: 700, fontSize: 10, color: COLORS.ink, paddingRight: 12 },
  totalsValue: { width: LINE_COLUMNS.price + LINE_COLUMNS.quantity, textAlign: 'right', fontFamily: FONTS.body, fontSize: 10, color: COLORS.ink },
  totalsValueEmph: { fontWeight: 700 },

  // ---- headings / terms / closing ----
  heading: { fontFamily: FONTS.body, fontWeight: 700, fontSize: 11, color: COLORS.ink, marginTop: 12, marginBottom: 6 },
  clause: { fontFamily: FONTS.body, fontSize: 9.5, color: COLORS.ink, lineHeight: 1.4, marginBottom: 3 },
  closing: { fontFamily: FONTS.body, fontSize: 10, color: COLORS.ink, lineHeight: 1.45, marginTop: 12, marginBottom: 14 },
  signoffLine: { fontFamily: FONTS.body, fontSize: 10, color: COLORS.ink, lineHeight: 1.4 },
  signoffName: { fontFamily: FONTS.body, fontWeight: 700, fontSize: 10, color: COLORS.ink, lineHeight: 1.4 },
});

/**
 * Renders a user free-text string with inline **bold** / __underline__ / *italic* runs.
 * Plain text (no tokens) collapses to a single run, so output is byte-identical to the
 * old `<Text style>{value}</Text>`. `style` is applied to the wrapper and inherited by runs.
 */
export function Inline({ text, style }: { text: string; style?: Style }) {
  const runs = parseInline(text);
  return (
    <Text style={style}>
      {runs.map((r, i) => {
        const run: Style = {};
        if (r.bold) run.fontWeight = 700;
        if (r.italic) run.fontStyle = 'italic';
        if (r.underline) run.textDecoration = 'underline';
        const hasStyle = r.bold || r.italic || r.underline;
        return (
          <Text key={i} style={hasStyle ? run : undefined}>
            {r.text}
          </Text>
        );
      })}
    </Text>
  );
}

export function HeaderBand({ assets }: { profile: CompanyProfile; assets: PdfAssets }) {
  return (
    <View fixed style={styles.headerFixed}>
      <Image style={styles.headerBandImg} src={assets.headerBand} />
    </View>
  );
}

export function FooterBand({
  assets,
  variant = 'quotation',
}: {
  profile: CompanyProfile;
  assets: PdfAssets;
  variant?: 'quotation' | 'proforma';
}) {
  const proforma = variant === 'proforma';
  return (
    <View fixed style={proforma ? styles.footerFixedPro : styles.footerFixed}>
      <Image
        style={proforma ? styles.footerStripPro : styles.footerStrip}
        src={proforma ? assets.footerStripProforma : assets.footerStrip}
      />
    </View>
  );
}

/** Right-hand issuing-entity block under the title word (03 §3.1). */
export function EntityBlock({ profile }: { profile: CompanyProfile }) {
  const lines = [
    profile.legalNameEn,
    ...profile.addressLines,
    [...profile.phone, profile.mobile].filter(Boolean).join(' | '),
    profile.website,
    `VAT: ${profile.vatNo}`,
    `C.R: ${profile.crNo}`,
  ].filter(Boolean);
  return (
    <View style={styles.entityBlock}>
      {lines.map((l, i) => (
        <Text key={i} style={styles.entityLine}>{l}</Text>
      ))}
    </View>
  );
}

export function MetaField({ label, value, bold = true, full = false }: { label: string; value: string; bold?: boolean; full?: boolean }) {
  if (!value) return null; // EC-8: blank optional fields omit cleanly
  return (
    <View style={full ? styles.metaFull : styles.metaCell}>
      <Text>
        <Text style={styles.metaLabel}>{label} </Text>
        <Text style={bold ? styles.metaValue : styles.metaValuePlain}>{value}</Text>
      </Text>
    </View>
  );
}

const align = (a: 'left' | 'center' | 'right') =>
  a === 'center' ? styles.cellCenter : a === 'right' ? styles.cellRight : undefined;

export function LineItemsTable({ lines, totals, variant = 'quotation' }: { lines: readonly LineItem[]; totals: ComputedTotals; variant?: 'quotation' | 'proforma' }) {
  const proforma = variant === 'proforma';
  const labels = proforma
    ? ['Sl.No', 'Description', 'Unit', 'Qty', 'Unit Rate (SAR)', 'Total (SAR)']
    : ['S. No', 'Description', 'Unit Price (SAR)', 'UOM', 'Quantity', 'Price (SAR)'];
  const keys = ['sno', 'description', 'unitPrice', 'uom', 'quantity', 'price'] as const;
  const header: Array<{ key: (typeof keys)[number]; label: string; a: 'left' | 'center' | 'right' }> = keys.map((key, i) => ({
    key,
    label: labels[i]!,
    a: key === 'description' ? 'left' : key === 'unitPrice' || key === 'price' ? 'right' : 'center',
  }));
  return (
    <View>
      <View style={styles.tableHeader}>
        {header.map((h) => (
          <View key={h.key} style={{ width: LINE_COLUMNS[h.key] }}>
            <Text style={[styles.th, align(h.a)]}>{h.label}</Text>
          </View>
        ))}
      </View>
      {lines.map((line, i) => {
        const price = totals.lines[i]?.priceHalalas ?? 0;
        const included = line.pricing === 'included';
        return (
          <View key={line.id} style={[styles.row, i % 2 === 1 ? styles.rowAlt : undefined]}>
            <View style={{ width: LINE_COLUMNS.sno }}><Text style={[styles.cell, styles.cellCenter]}>{i + 1}</Text></View>
            <View style={{ width: LINE_COLUMNS.description }}><Inline text={line.description} style={styles.cell} /></View>
            <View style={{ width: LINE_COLUMNS.unitPrice }}>
              <Text style={[styles.cell, styles.cellRight]}>{included ? 'included' : formatSar(line.unitPriceHalalas)}</Text>
            </View>
            <View style={{ width: LINE_COLUMNS.uom }}><Text style={[styles.cell, styles.cellCenter]}>{line.uom}</Text></View>
            <View style={{ width: LINE_COLUMNS.quantity }}>
              <Text style={[styles.cell, styles.cellCenter]}>{formatQty(line.qtyHundredths)}</Text>
            </View>
            <View style={{ width: LINE_COLUMNS.price }}>
              <Text style={[styles.cell, styles.cellRight]}>{included ? 'included' : formatSarPrefixed(price)}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Format integer-hundredths quantity as a clean decimal (100 -> 1, 50 -> 0.5, 5000 -> 50). */
export function formatQty(qtyHundredths: number): string {
  const whole = Math.trunc(qtyHundredths / 100);
  const frac = qtyHundredths % 100;
  if (frac === 0) return String(whole);
  const fracStr = String(frac).padStart(2, '0').replace(/0+$/, '');
  return `${whole}.${fracStr}`;
}

export type TotalRow = { label: string; halalas: number; emphasise?: boolean };

export function TotalsStack({ rows }: { rows: TotalRow[] }) {
  return (
    <View style={styles.totalsWrap}>
      {rows.map((r) => (
        <View key={r.label} style={[styles.totalsRow, r.emphasise ? styles.totalsRowEmph : undefined]}>
          <Text style={styles.totalsLabel}>{r.label}</Text>
          <Text style={[styles.totalsValue, r.emphasise ? styles.totalsValueEmph : undefined]}>
            {formatSarPrefixed(r.halalas)}
          </Text>
        </View>
      ))}
    </View>
  );
}
