/**
 * pdf/primitives.tsx — shared, pure @react-pdf building blocks (Build-kit/03 §2-§4).
 *
 * Bands are rebuilt as VECTOR (black rect + rotated-square chevrons + gold rule), never
 * the raster letterhead (allowed upgrade #1). Only the cropped logo marks are images.
 * Every component is a pure function of its props: no clock, no random, no network.
 */

import { StyleSheet, View, Text, Image } from '@react-pdf/renderer';
import { COLORS, FONTS, LINE_COLUMNS, PAGE, CONTENT_WIDTH_PT } from './theme';
import { formatSar, formatSarPrefixed } from '@/lib/money';
import type { ComputedTotals } from '@/domain/calc';
import type { CompanyProfile, LineItem } from '@/domain/types';

export type PdfAssets = { headerMark: string; footerMark: string };

export const styles = StyleSheet.create({
  // ---- header band (edge-to-edge, 03 §2.1) ----
  headerFixed: { position: 'absolute', top: 0, left: 0, width: PAGE.widthPt },
  headerBand: {
    width: PAGE.widthPt,
    height: 66,
    backgroundColor: COLORS.band,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 26,
  },
  chevronWrap: { width: 92, height: 66, marginLeft: -34, position: 'relative' },
  chevron: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderTopWidth: 3,
    borderRightWidth: 3,
    transform: 'rotate(45deg)',
  },
  headerTitles: { flex: 1, marginLeft: 6 },
  companyName: {
    fontFamily: FONTS.body,
    fontWeight: 700,
    fontSize: 20,
    lineHeight: 1.15,
    color: COLORS.paper,
    letterSpacing: 0.5,
  },
  tagline: {
    fontFamily: FONTS.band,
    fontSize: 9,
    color: '#D8D8D8',
    letterSpacing: 1.4,
    marginTop: 3,
  },
  headerMark: { width: 60, height: 52 },
  goldRuleWrap: { width: CONTENT_WIDTH_PT, marginLeft: PAGE.margin.left, flexDirection: 'row', marginTop: 6 },
  goldRuleSeg: { height: 1.5, flex: 1 },

  // ---- footer band (inset to margins, 03 §2.2) ----
  footerFixed: { position: 'absolute', bottom: 0, left: 0, width: PAGE.widthPt },
  footerBand: {
    marginLeft: PAGE.margin.left,
    width: CONTENT_WIDTH_PT,
    minHeight: 58,
    backgroundColor: COLORS.band,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  footerMark: { width: 78, height: 40, marginRight: 14 },
  footerCol: { flex: 1, marginRight: 10 },
  footerLabel: { fontFamily: FONTS.body, fontWeight: 700, fontSize: 9, color: COLORS.paper, marginRight: 4 },
  footerText: { fontFamily: FONTS.body, fontSize: 9, color: COLORS.paper, lineHeight: 1.35 },
  goldInfoBand: {
    marginLeft: PAGE.margin.left,
    width: CONTENT_WIDTH_PT,
    height: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.gold,
    paddingHorizontal: 8,
  },
  goldInfoText: { fontFamily: FONTS.body, fontSize: 8, color: COLORS.paper, letterSpacing: 0.3 },

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
  tableHeader: { flexDirection: 'row', backgroundColor: COLORS.headerShade, borderBottomWidth: 1, borderBottomColor: COLORS.ink },
  th: { fontFamily: FONTS.body, fontWeight: 700, fontSize: 9, color: COLORS.ink, paddingVertical: 5, paddingHorizontal: 4 },
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
});

/** Nested right-pointing chevrons bleeding off the left edge (vector). */
export function ChevronMotif() {
  const greys = [COLORS.paper, '#CFCFCF', '#9A9A9A', '#6E6E6E', '#4A4A4A'];
  return (
    <View style={styles.chevronWrap}>
      {greys.map((color, i) => (
        <View
          key={i}
          style={[
            styles.chevron,
            {
              left: 10 + i * 16,
              top: 22,
              borderTopColor: color,
              borderRightColor: color,
            },
          ]}
        />
      ))}
    </View>
  );
}

export function HeaderBand({ profile, assets }: { profile: CompanyProfile; assets: PdfAssets }) {
  return (
    <View fixed style={styles.headerFixed}>
      <View style={styles.headerBand}>
        <ChevronMotif />
        <View style={styles.headerTitles}>
          <Text style={styles.companyName}>{profile.legalNameEn}</Text>
          <Text style={styles.tagline}>{profile.tagline}</Text>
        </View>
        <Image style={styles.headerMark} src={assets.headerMark} />
      </View>
      <View style={styles.goldRuleWrap}>
        {[COLORS.goldDark, COLORS.gold, COLORS.goldLight].map((c) => (
          <View key={c} style={[styles.goldRuleSeg, { backgroundColor: c }]} />
        ))}
      </View>
    </View>
  );
}

export function FooterBand({ profile, assets }: { profile: CompanyProfile; assets: PdfAssets }) {
  const contact = [...profile.phone, profile.mobile].filter(Boolean).join(' | ');
  return (
    <View fixed style={styles.footerFixed}>
      <View style={styles.footerBand}>
        <Image style={styles.footerMark} src={assets.footerMark} />
        <View style={styles.footerCol}>
          <Text style={styles.footerText}>
            <Text style={styles.footerLabel}>Address </Text>
            {profile.addressLines.join(', ')}
          </Text>
        </View>
        <View style={styles.footerCol}>
          <Text style={styles.footerText}>
            <Text style={styles.footerLabel}>Contact </Text>
            {contact}
          </Text>
          <Text style={styles.footerText}>{profile.email}</Text>
        </View>
      </View>
      <View style={styles.goldInfoBand}>
        <Text style={styles.goldInfoText}>{profile.website}</Text>
        <Text style={styles.goldInfoText}>VAT: {profile.vatNo}</Text>
        <Text style={styles.goldInfoText}>AC: {profile.iban}</Text>
        <Text style={styles.goldInfoText}>C.R: {profile.crNo}</Text>
      </View>
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
            <View style={{ width: LINE_COLUMNS.description }}><Text style={styles.cell}>{line.description}</Text></View>
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
