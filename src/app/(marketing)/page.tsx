/**
 * app/(marketing)/page.tsx — public landing (URL: `/`).
 *
 * Product overview for a signed-out visitor: what Quotegen does, what makes it
 * different, and a single, unambiguous CTA (Sign in / Create account). Everything
 * here is static — no session read, no /api fetch — so Next.js prerenders it and
 * the marketing page stays fast on cold boots.
 *
 * The hero illustration is an inline SVG (a stylised quote PDF with a gold check
 * seal). Kept inline rather than as a raster asset because (a) it stays crisp at
 * any size, (b) it costs zero extra HTTP round-trips, and (c) it lets us re-tint
 * with brand tokens (currentColor + the gold var) without a rebuild.
 */

import Link from 'next/link';
import { ClipartInvoice } from './clipart';

export default function LandingPage() {
  return (
    <main>
      <Hero />
      <Features />
      <HowItWorks />
      <ClosingCta />
    </main>
  );
}

/* ---------- Hero ---------- */

function Hero() {
  return (
    <section className="bg-paper border-b border-neutral-200 px-4 py-14 sm:py-20">
      <div className="mx-auto grid max-w-5xl items-center gap-10 sm:grid-cols-[1.15fr_1fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">
            For contractors &amp; consultants
          </p>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight sm:text-5xl">
            Deterministic quotations &amp; proforma invoices, in minutes.
          </h1>
          <p className="mt-4 max-w-prose text-base text-muted">
            Quotegen turns a guided 4-step wizard into a byte-stable PDF that matches your
            letterhead exactly — the same inputs always produce the same document, so
            revisions are auditable and your finance team stops chasing formatting drift.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/sign-in"
              className="rounded bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              Sign in →
            </Link>
            <Link
              href="/sign-up"
              className="rounded border border-neutral-300 bg-white px-5 py-2.5 text-sm font-semibold hover:bg-neutral-100"
            >
              Create a free account
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted">
            No credit card. Your company profile stays in your browser; the account only
            powers cross-device reuse and history.
          </p>
        </div>
        <div className="flex justify-center sm:justify-end">
          <ClipartInvoice className="h-auto w-full max-w-[360px]" />
        </div>
      </div>
    </section>
  );
}

/* ---------- Features ---------- */

type Feature = { title: string; body: string; icon: React.ReactNode };

function Features() {
  const items: ReadonlyArray<Feature> = [
    {
      title: 'Guided 4-step wizard',
      body: 'Meta → line items → terms → review. Every required field validated inline; half-typed drafts simply cannot export.',
      icon: <IconSteps />,
    },
    {
      title: 'Reusable clients & sign-offs',
      body: 'Step 1 auto-saves each client (deduped by name + Cust ID); Step 3 remembers your signatory blocks. One click to autofill next time.',
      icon: <IconUsers />,
    },
    {
      title: 'Byte-stable PDF output',
      body: 'The same document re-renders identically tomorrow, on a different machine. Verbatim strings, exact geometry, deterministic totals.',
      icon: <IconLock />,
    },
    {
      title: 'Encompass / Elaf letterhead',
      body: 'Bundled header band, footer strip, brand marks and bilingual (EN + AR) fonts — no logo upload, no CSS tweaking.',
      icon: <IconBrand />,
    },
    {
      title: 'Recent documents, re-renderable',
      body: 'Every export is stored as a payload, not a binary. Open a past quote, adjust a line, get an identical-format PDF with the change applied.',
      icon: <IconHistory />,
    },
    {
      title: 'Private by default',
      body: 'Email + password auth (Better Auth), Postgres on Neon with per-user FKs, and a signed-in KPI strip that only you can see.',
      icon: <IconShield />,
    },
  ];

  return (
    <section className="bg-panel px-4 py-14">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-2xl font-bold sm:text-3xl">What makes it different</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Six things the generic invoice SaaS either can&apos;t do, or does in a way that makes your
          finance team pay for it later.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((f) => (
            <article
              key={f.title}
              className="flex gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
            >
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/10 text-gold">
                {f.icon}
              </span>
              <div>
                <h3 className="text-sm font-bold">{f.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">{f.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- How it works ---------- */

const STEPS: ReadonlyArray<{ n: string; title: string; body: string }> = [
  { n: '1', title: 'Meta', body: 'Document number, dates, and the client — Quotegen remembers every client you have typed before.' },
  { n: '2', title: 'Line items', body: 'Description, unit price, UOM, quantity. VAT, discount and splits calculate exactly, every time.' },
  { n: '3', title: 'Terms & sign-off', body: 'Fixed default clauses seeded on every quote; suggested additions one click away. Sign-off block auto-saves.' },
  { n: '4', title: 'Review & export', body: 'Live PDF preview, then download or print. The same payload re-renders byte-identical from your Recent list.' },
];

function HowItWorks() {
  return (
    <section className="px-4 py-14">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-2xl font-bold sm:text-3xl">From blank form to signed PDF in four steps</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Each step validates before you can advance, so nothing gets to the PDF half-typed.
        </p>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="relative rounded-lg border border-neutral-200 bg-white p-5 shadow-sm"
            >
              <span
                aria-hidden
                className="absolute -top-3 left-4 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black text-xs font-bold text-white"
              >
                {s.n}
              </span>
              <h3 className="mt-1 text-sm font-bold uppercase tracking-wide">{s.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------- Closing CTA ---------- */

function ClosingCta() {
  return (
    <section className="bg-band px-4 py-14 text-band-ink">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">Ready to stop formatting PDFs?</h2>
          <p className="mt-2 max-w-prose text-sm text-band-muted">
            Create an account and export your first quotation in under two minutes —
            the wizard handles the rest.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/sign-up"
            className="rounded bg-gold px-5 py-2.5 text-sm font-bold text-band hover:bg-gold-light hover:text-band"
          >
            Create a free account →
          </Link>
          <Link
            href="/sign-in"
            className="rounded border border-band-ink/30 px-5 py-2.5 text-sm font-semibold text-band-ink hover:border-gold-light hover:text-gold-light"
          >
            I already have one
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ---------- Feature icons (small inline SVGs, 20×20, stroke follows currentColor) ---------- */

const ICON_PROPS = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className: 'h-5 w-5',
  'aria-hidden': true,
};

function IconSteps() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 18h3v-3h4v-3h4V7h4" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3 3-5 6-5s6 2 6 5" />
      <circle cx="17" cy="9" r="2.2" />
      <path d="M15.5 14.5c2.5 0 5.5 1.5 5.5 4.5" />
    </svg>
  );
}
function IconLock() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
function IconBrand() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 6h16v12H4z" />
      <path d="M4 10h16" />
      <path d="M9 14h6" />
    </svg>
  );
}
function IconHistory() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 12a8 8 0 1 0 3-6.2" />
      <path d="M4 4v5h5" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
