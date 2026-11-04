/**
 * pdf/proforma.tsx — the `proforma` template (Build-kit/03 §4, FR-1).
 *
 * 1-page shape: title strip, MODE OF PAYMENT, ACCOUNT DETAILS (incl. the single RTL
 * Arabic legal-name run), line items (with `included` cells), totals stack ending in the
 * `<pct>% Advance` row. Bands repeat via <View fixed>. Pure over PdfInput.
 */

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { PAGE, FONTS, COLORS } from './theme';
import { styles as s, HeaderBand, FooterBand, EntityBlock, LineItemsTable, TotalsStack, Inline } from './primitives';
import { shapeArabicForRender } from '@/lib/rtl';
import type { PdfInput } from './input';

const local = StyleSheet.create({
  page: { size: PAGE.size, paddingTop: PAGE.margin.top, paddingBottom: PAGE.margin.bottom, paddingLeft: PAGE.margin.left, paddingRight: PAGE.margin.right },
  modeRow: { marginBottom: 10 },
  acctLabel: { fontFamily: FONTS.body, fontSize: 9, color: COLORS.muted },
  acctValue: { fontFamily: FONTS.body, fontWeight: 700, fontSize: 10, color: COLORS.ink },
  acctLine: { marginBottom: 2 },
  arabic: { fontFamily: FONTS.arabic, fontSize: 11, color: COLORS.ink, textAlign: 'right', marginBottom: 2 },
});

function AcctRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <Text style={local.acctLine}>
      <Text style={local.acctLabel}>{label} </Text>
      <Text style={local.acctValue}>{value}</Text>
    </Text>
  );
}

export function ProformaDoc({ doc, profile, totals, assets }: PdfInput) {
  const { client, lines } = doc;

  const totalRows = [
    { label: 'Total after Discount', halalas: totals.baseHalalas },
    { label: 'VAT', halalas: totals.vatHalalas },
    { label: 'Grand Total', halalas: totals.grandTotalHalalas, emphasise: true },
    ...totals.splits.map((sp) => ({ label: sp.label, halalas: sp.halalas })),
  ];

  return (
    <Document>
      <Page size={PAGE.size} style={local.page}>
        <HeaderBand profile={profile} assets={assets} />
        <FooterBand profile={profile} assets={assets} variant="proforma" />

        <View style={s.titleRow}>
          <Text style={[s.titleWord, { fontSize: 34 }]}>PROFORMA INVOICE</Text>
          <EntityBlock profile={profile} />
        </View>

        <View style={local.modeRow}>
          <Text>
            <Text style={local.acctLabel}>MODE OF PAYMENT: </Text>
            <Text style={local.acctValue}>BANK TRANSFER</Text>
          </Text>
        </View>

        <Text style={s.heading}>ACCOUNT DETAILS</Text>
        <View style={{ marginBottom: 12 }}>
          <AcctRow label="BANK NAME:" value={profile.bankName} />
          {profile.legalNameAr ? <Text style={local.arabic}>{shapeArabicForRender(profile.legalNameAr)}</Text> : null}
          <AcctRow label="IBAN:" value={profile.iban} />
          <AcctRow label="C.R:" value={profile.crNo} />
          <AcctRow label="SWIFT -" value={profile.swift} />
        </View>

        <View style={s.metaFull}>
          <Inline text={client.name} style={s.metaValue} />
          {client.addressLines.filter(Boolean).map((l, i) => (
            <Inline key={i} text={l} style={s.metaValuePlain} />
          ))}
        </View>

        <LineItemsTable lines={lines} totals={totals} variant="proforma" />

        <TotalsStack rows={totalRows} />
      </Page>
    </Document>
  );
}
