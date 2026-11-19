/**
 * profile/sections.tsx — shared company-profile editor sections (#37).
 *
 * The same field groups back two surfaces: the full Settings editor (`(app)/settings`) and
 * the one-time first-run onboarding wizard (`(onboarding)/onboarding`). They are extracted
 * here so the two never drift — a label or field added to one shows up in both, and the
 * Settings tests that pin exact `getByLabelText` targets keep guarding the onboarding copy
 * for free.
 *
 * These are pure presentational pieces: the parent owns the `profile` state and the
 * `patch`/`patchSig`/asset handlers, so onboarding can drive a subset as wizard steps while
 * Settings keeps its single-page save/reset flow. Markup and classNames are intentionally
 * identical to what Settings rendered before the split.
 */

'use client';

import { useId, type ReactNode } from 'react';
import { TextField, LinesTextArea } from '@/wizard/fields';
import { MAX_ASSET_BYTES, type BrandAssets } from '@/lib/storage';
import type { AssetKind } from '@/lib/storage';
import type { CompanyProfile } from '@/domain/types';

/** Card chrome shared by every section; the parent can still add its own alternating tint. */
export const SECTION_CLASS = 'space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4';
const HEADING_CLASS = 'text-sm font-bold uppercase tracking-wide text-muted';

type Patch = (p: Partial<CompanyProfile>) => void;
type PatchSig = (p: Partial<CompanyProfile['signatory']>) => void;

/**
 * Section chrome. Settings renders every group collapsible (#50: a 2 640 px, ~3.1-screen
 * single column), while onboarding keeps the always-open `<section>` cards it already used.
 * A collapsed `<details>` still exposes its fields to the DOM/a11y tree, so the exact
 * `getByLabelText` selectors the Settings tests pin keep resolving whether open or shut.
 */
function SectionShell({ title, collapsible, children }: { title: string; collapsible?: boolean; children: ReactNode }) {
  if (collapsible) {
    return (
      <details className={SECTION_CLASS} open>
        <summary className={`cursor-pointer select-none ${HEADING_CLASS}`}>{title}</summary>
        {children}
      </details>
    );
  }
  return (
    <section className={SECTION_CLASS}>
      <h2 className={HEADING_CLASS}>{title}</h2>
      {children}
    </section>
  );
}

/** Read a picked File into a base64 data URL (browser only). */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * One preview + upload row for a brand mark slot. #50: the raw `input[type=file]` rendered a
 * ~24 px native "Choose File" chip; the real input is now `sr-only` and a 44 px styled
 * `<label htmlFor>` (with the slot name as its accessible name, which the upload tests pin)
 * is the tap target. The thumbnail stays as the visual preview.
 */
export function MarkUpload({
  label,
  src,
  overridden,
  onPick,
}: {
  label: string;
  src: string;
  overridden: boolean;
  onPick: (file: File | undefined) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`${label} preview`}
        className="h-14 w-14 shrink-0 rounded border border-neutral-300 bg-white object-contain"
      />
      <div className="min-w-0 flex-1">
        <input
          id={id}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          aria-label={label}
          onChange={(e) => onPick(e.target.files?.[0])}
          className="sr-only"
        />
        <label
          htmlFor={id}
          className="inline-flex min-h-[2.75rem] cursor-pointer items-center rounded border border-neutral-400 px-4 text-sm font-medium hover:bg-neutral-100"
        >
          {label}
        </label>
        <p className="mt-1 text-xs text-muted">{overridden ? 'Using your uploaded image.' : 'PNG, JPEG, GIF or WebP (max 2 MB).'}</p>
      </div>
    </div>
  );
}

export function IdentitySection({ profile, patch, collapsible }: { profile: CompanyProfile; patch: Patch; collapsible?: boolean }) {
  return (
    <SectionShell title="Identity" collapsible={collapsible}>
      <TextField label="Legal name (EN)" value={profile.legalNameEn} onChange={(v) => patch({ legalNameEn: v })} />
      <TextField label="Legal name (AR)" value={profile.legalNameAr ?? ''} hint="Printed right-aligned in the proforma account block" onChange={(v) => patch({ legalNameAr: v })} />
      <TextField label="Tagline" value={profile.tagline} onChange={(v) => patch({ tagline: v })} />
      <LinesTextArea label="Address lines" lines={profile.addressLines} onChange={(lines) => patch({ addressLines: lines })} />
    </SectionShell>
  );
}

export function ContactSection({ profile, patch, collapsible }: { profile: CompanyProfile; patch: Patch; collapsible?: boolean }) {
  return (
    <SectionShell title="Contact &amp; fiscal" collapsible={collapsible}>
      <LinesTextArea label="Phone numbers" lines={profile.phone} onChange={(lines) => patch({ phone: lines })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Mobile" value={profile.mobile} inputMode="tel" onChange={(v) => patch({ mobile: v })} />
        <TextField label="Email" type="email" value={profile.email} onChange={(v) => patch({ email: v })} />
        <TextField label="Website" value={profile.website} onChange={(v) => patch({ website: v })} />
        <TextField label="VAT number" value={profile.vatNo} onChange={(v) => patch({ vatNo: v })} />
        <TextField label="C.R. number" value={profile.crNo} inputMode="numeric" onChange={(v) => patch({ crNo: v })} />
      </div>
    </SectionShell>
  );
}

export function BankSection({ profile, patch, collapsible }: { profile: CompanyProfile; patch: Patch; collapsible?: boolean }) {
  return (
    <SectionShell title="Bank (proforma)" collapsible={collapsible}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Bank name" value={profile.bankName} onChange={(v) => patch({ bankName: v })} />
        <TextField label="IBAN / AC" value={profile.iban} onChange={(v) => patch({ iban: v })} />
        <TextField label="SWIFT" value={profile.swift} onChange={(v) => patch({ swift: v })} />
        <TextField label="Account no. (optional)" value={profile.accountNo ?? ''} inputMode="numeric" onChange={(v) => patch({ accountNo: v })} />
      </div>
    </SectionShell>
  );
}

export function SignatorySection({ profile, patchSig, collapsible }: { profile: CompanyProfile; patchSig: PatchSig; collapsible?: boolean }) {
  return (
    <SectionShell title="Signatory" collapsible={collapsible}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Name" value={profile.signatory.name} onChange={(v) => patchSig({ name: v })} />
        <TextField label="Title" value={profile.signatory.title} onChange={(v) => patchSig({ title: v })} />
        <TextField label="Mobile" value={profile.signatory.mobile} inputMode="tel" onChange={(v) => patchSig({ mobile: v })} />
        <TextField label="Email" type="email" value={profile.signatory.email} onChange={(v) => patchSig({ email: v })} />
      </div>
    </SectionShell>
  );
}

export function BrandMarksSection({
  profile,
  assets,
  assetError,
  onPick,
  onReset,
  collapsible,
}: {
  profile: CompanyProfile;
  assets: BrandAssets;
  assetError: string;
  onPick: (kind: AssetKind, file: File | undefined) => void;
  onReset: () => void;
  collapsible?: boolean;
}) {
  const body = (
    <>
      <button
        type="button"
        onClick={onReset}
        className="inline-flex min-h-[2.75rem] items-center rounded border border-neutral-400 px-3 text-sm hover:bg-neutral-100"
      >
        Reset to bundled crops
      </button>
      <p className="text-xs text-muted">
        Replaced logos are saved to your account and follow you across devices while you are
        signed in (max {Math.round(MAX_ASSET_BYTES / 1024)} KB each); offline they stay on this
        device. They are kept separate from the profile fields. The header/footer colour bands
        stay bundled.
      </p>
      <MarkUpload
        label="Header logo"
        src={assets.headerMark || profile.logos.headerMark}
        overridden={!!assets.headerMark}
        onPick={(file) => onPick('headerMark', file)}
      />
      <MarkUpload
        label="Footer logo"
        src={assets.footerMark || profile.logos.footerMark}
        overridden={!!assets.footerMark}
        onPick={(file) => onPick('footerMark', file)}
      />
      {assetError && <p role="alert" className="text-sm font-medium text-red-700">{assetError}</p>}
    </>
  );
  if (collapsible) {
    return (
      <details className={SECTION_CLASS} open>
        <summary className={`cursor-pointer select-none ${HEADING_CLASS}`}>Brand marks</summary>
        {body}
      </details>
    );
  }
  return (
    <section className={SECTION_CLASS}>
      <h2 className={HEADING_CLASS}>Brand marks</h2>
      {body}
    </section>
  );
}
