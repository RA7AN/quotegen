/**
 * pdf/quotation.tsx — the `quotation` template (Build-kit/03 §3, FR-1).
 *
 * Pure over PdfInput. Page 1: title strip, meta, attn/subject, line items, totals,
 * payment terms. Page 2: terms & conditions, closing, sign-off. Bands repeat on every
 * page via <View fixed>. No clock/random/network.
 */

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { PAGE, FONTS, COLORS } from './theme';
import { styles as s, HeaderBand, FooterBand, EntityBlock, MetaField, LineItemsTable, TotalsStack } from './primitives';
import { formatOrdinalDate } from '@/lib/dates';
import { fillInLiteral } from '@/lib/escape';
import type { PdfInput } from './input';

const local = StyleSheet.create({
  page: { size: PAGE.size, paddingTop: PAGE.margin.top, paddingBottom: PAGE.margin.bottom, paddingLeft: PAGE.margin.left, paddingRight: PAGE.margin.right },
  attn: { fontFamily: FONTS.body, fontSize: 10, color: COLORS.ink, lineHeight: 1.4, marginBottom: 10 },
});

export function QuotationDoc({ doc, profile, totals, assets }: PdfInput) {
  const { meta, client, lines, commercials, terms, closing } = doc;

  return (
    <Document>
      {/* ---------- Page 1 ---------- */}
      <Page size={PAGE.size} style={local.page}>
        <HeaderBand profile={profile} assets={assets} />
        <FooterBand profile={profile} assets={assets} />

        <View style={s.titleRow}>
          <Text style={s.titleWord}>QUOTATION</Text>
          <EntityBlock profile={profile} />
        </View>

        <View style={s.metaGrid}>
          <MetaField label="Quotation #:" value={meta.docNo} />
          <MetaField label="Valid Until:" value={formatOrdinalDate(meta.validUntilISO)} />
          <MetaField label="Quotation Date:" value={formatOrdinalDate(meta.quoteDateISO)} />
        </View>

        <View style={s.metaFull}>
          <Text style={s.metaValue}>{client.name}</Text>
          {client.addressLines.filter(Boolean).map((l, i) => (
            <Text key={i} style={s.metaValuePlain}>{l}</Text>
          ))}
          <MetaField label="Cust ID:" value={client.custId} bold={false} full />
          <MetaField label="City:" value={client.city} bold={false} full />
          <MetaField label="CR No.:" value={client.crNo} bold={false} full />
        </View>

        <Text style={local.attn}>
          {meta.attn ? `Attn. ${meta.attn},` : ''}
          {meta.attn ? '\n' : ''}
          {fillInLiteral('Kindly find the attached quotation for {subject}.', { subject: meta.subject })}
        </Text>

        <LineItemsTable lines={lines} totals={totals} />

        <TotalsStack
          rows={[
            { label: 'Total', halalas: totals.totalHalalas },
            { label: 'VAT', halalas: totals.vatHalalas },
            { label: 'Grand Total', halalas: totals.grandTotalHalalas, emphasise: true },
          ]}
        />

        {commercials.paymentTermsText.filter(Boolean).length > 0 && (
          <View>
            <Text style={s.heading}>Payment Terms</Text>
            {commercials.paymentTermsText.filter(Boolean).map((t, i) => (
              <Text key={i} style={s.clause}>{t}</Text>
            ))}
          </View>
        )}
      </Page>

      {/* ---------- Page 2 ---------- */}
      <Page size={PAGE.size} style={local.page}>
        <HeaderBand profile={profile} assets={assets} />
        <FooterBand profile={profile} assets={assets} />

        <Text style={s.heading}>Terms &amp; Conditions</Text>
        {terms.clauses.map((c, i) => (
          <Text key={i} style={s.clause}>{`${i + 1}. ${c}`}</Text>
        ))}

        <Text style={s.closing}>
          We trust this quotation meets your requirements and look forward to your positive
          response. For further clarifications, please feel free to contact us.
        </Text>

        <View>
          <Text style={s.signoffLine}>{closing.signoff}</Text>
          {closing.name ? <Text style={s.signoffLine}>{closing.name}</Text> : null}
          {closing.org ? <Text style={s.signoffLine}>{closing.org}</Text> : null}
          {closing.mobile ? <Text style={s.signoffLine}>Mob: {closing.mobile}</Text> : null}
          {closing.email ? <Text style={s.signoffLine}>{closing.email}</Text> : null}
          {closing.website ? <Text style={s.signoffLine}>{closing.website}</Text> : null}
        </View>
      </Page>
    </Document>
  );
}
