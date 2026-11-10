/**
 * app/(marketing)/clipart.tsx — inline SVG hero illustration for the landing page.
 *
 * Deliberately inline (rather than a PNG/JPG in `public/brand/`) so it stays crisp at
 * every viewport, ships zero extra HTTP weight alongside the marketing page bundle,
 * and picks up the gold brand token via `currentColor` if we ever re-tint it. It is
 * purely decorative — `role="presentation"` + `aria-hidden` keeps it out of the
 * accessibility tree.
 */

export function ClipartInvoice({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 340 400"
      role="presentation"
      aria-hidden
      className={className}
    >
      {/* Ground shadow */}
      <ellipse cx="180" cy="382" rx="120" ry="10" fill="#000" opacity="0.08" />

      {/* Back sheet (slight offset) */}
      <g transform="rotate(-4 180 210)">
        <rect x="60" y="46" width="230" height="308" rx="6" fill="#f4f4f4" stroke="#d4d4d4" strokeWidth="1.5" />
      </g>

      {/* Main sheet */}
      <g transform="rotate(2 180 210)">
        <rect x="52" y="38" width="230" height="316" rx="6" fill="#ffffff" stroke="#111" strokeWidth="1.6" />

        {/* Header band */}
        <rect x="52" y="38" width="230" height="42" rx="6" fill="#000" />
        <rect x="52" y="76" width="230" height="4" fill="#a8842c" />

        {/* Wordmark + document title (abstracted) */}
        <rect x="64" y="52" width="42" height="8" rx="1.5" fill="#ffffff" />
        <rect x="64" y="63" width="28" height="4" rx="1" fill="#a8842c" />
        <rect x="188" y="52" width="82" height="8" rx="1.5" fill="#ffffff" />
        <rect x="212" y="64" width="58" height="4" rx="1" fill="#c9c9c9" />

        {/* Client block (3 short lines) */}
        <rect x="64" y="96" width="46" height="3" rx="1" fill="#a3a3a3" />
        <rect x="64" y="104" width="86" height="5" rx="1" fill="#111" />
        <rect x="64" y="115" width="70" height="3" rx="1" fill="#a3a3a3" />
        <rect x="64" y="122" width="52" height="3" rx="1" fill="#a3a3a3" />

        {/* Table header */}
        <rect x="64" y="142" width="206" height="14" rx="2" fill="#f5f5f5" />
        <rect x="70" y="147" width="14" height="4" rx="1" fill="#7d7d7d" />
        <rect x="94" y="147" width="36" height="4" rx="1" fill="#7d7d7d" />
        <rect x="176" y="147" width="24" height="4" rx="1" fill="#7d7d7d" />
        <rect x="210" y="147" width="18" height="4" rx="1" fill="#7d7d7d" />
        <rect x="240" y="147" width="24" height="4" rx="1" fill="#7d7d7d" />

        {/* Line items */}
        <LineItem y={168} descWidth={82} qty="2" price="1,200" />
        <LineItem y={188} descWidth={68} qty="1" price="850" />
        <LineItem y={208} descWidth={92} qty="4" price="2,400" />

        {/* Divider above totals */}
        <line x1="180" y1="234" x2="270" y2="234" stroke="#d4d4d4" strokeWidth="1" />

        {/* Sub-total / VAT / Grand total */}
        <TotalRow y={244} label="SUBTOTAL" amount="4,450" />
        <TotalRow y={262} label="VAT 15%" amount="667.50" />
        <rect x="180" y="278" width="90" height="18" rx="2" fill="#000" />
        <rect x="186" y="285" width="34" height="4" rx="1" fill="#a8842c" />
        <rect x="228" y="284" width="34" height="6" rx="1" fill="#ffffff" />

        {/* Terms block */}
        <rect x="64" y="240" width="26" height="3" rx="1" fill="#a8842c" />
        <rect x="64" y="250" width="82" height="3" rx="1" fill="#a3a3a3" />
        <rect x="64" y="258" width="72" height="3" rx="1" fill="#a3a3a3" />
        <rect x="64" y="266" width="86" height="3" rx="1" fill="#a3a3a3" />
        <rect x="64" y="274" width="54" height="3" rx="1" fill="#a3a3a3" />

        {/* Signature line */}
        <line x1="64" y1="326" x2="140" y2="326" stroke="#111" strokeWidth="1.2" />
        <rect x="64" y="332" width="34" height="3" rx="1" fill="#a3a3a3" />

        {/* Approved check seal (top-right, overlapping the header band) */}
        <g transform="translate(248 68)">
          <circle r="26" fill="#a8842c" />
          <circle r="26" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.35" />
          <circle r="20" fill="none" stroke="#ffffff" strokeWidth="1.4" opacity="0.55" strokeDasharray="2 3" />
          <path
            d="M -9 1 L -3 7 L 10 -6"
            fill="none"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </g>
    </svg>
  );
}

function LineItem({ y, descWidth, qty, price }: { y: number; descWidth: number; qty: string; price: string }) {
  return (
    <g>
      <rect x="64" y={y + 4} width="10" height="3" rx="1" fill="#a3a3a3" />
      <rect x="94" y={y + 3} width={descWidth} height="5" rx="1" fill="#111" />
      <rect x="94" y={y + 11} width={descWidth * 0.6} height="3" rx="1" fill="#c4c4c4" />
      <text
        x={228}
        y={y + 10}
        textAnchor="end"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontSize="8"
        fill="#111"
      >
        {qty}
      </text>
      <text
        x={270}
        y={y + 10}
        textAnchor="end"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontSize="8"
        fill="#111"
      >
        {price}
      </text>
      <line x1="64" y1={y + 17} x2="270" y2={y + 17} stroke="#eaeaea" strokeWidth="0.8" />
    </g>
  );
}

function TotalRow({ y, label, amount }: { y: number; label: string; amount: string }) {
  return (
    <g fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize="7" fill="#4a4a4a">
      <text x="184" y={y}>{label}</text>
      <text x="270" y={y} textAnchor="end" fill="#111">{amount}</text>
    </g>
  );
}
