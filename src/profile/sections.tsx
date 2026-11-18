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

import { useId } from 'react';
import { TextField, LinesTextArea } from '@/wizard/fields';
import { MAX_ASSET_BYTES, type BrandAssets } from '@/lib/storage';
import type { AssetKind } from '@/lib/storage';
import type { CompanyProfile } from '@/domain/types';

/** Card chrome shared by every section; the parent can still add its own alternating tint. */
export const SECTION_CLASS = 'space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4';
const HEADING_CLASS = 'text-sm font-bold uppercase tracking-wide text-muted';

type Patch = (p: Partial<CompanyProfile>) => void;
type PatchSig = (p: Partial<CompanyProfile['signatory']>) => void;

/** Read a picked File into a base64 data URL (browser only). */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** One preview + file-picker row for a brand mark slot. */
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
        <label htmlFor={id} className="block text-sm font-medium text-black">{label}</label>
        <input
          id={id}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={(e) => onPick(e.target.files?.[0])}
          className="mt-1 block w-full text-sm text-muted file:mr-2 file:rounded file:border-0 file:bg-neutral-200 file:px-2 file:py-1 file:text-black"
        />
        {overridden && <p className="mt-0.5 text-xs text-muted">Using your uploaded image.</p>}
      </div>
    </div>
  );
}

export function IdentitySection({ profile, patch }: { profile: CompanyProfile; patch: Patch }) {
  return (
    <section className={SECTION_CLASS}>
      <h2 className={HEADING_CLASS}>Identity</h2>
      <TextField label="Legal name (EN)" value={profile.legalNameEn} onChange={(v) => patch({ legalNameEn: v })} />
      <TextField label="Legal name (AR)" value={profile.legalNameAr ?? ''} hint="Printed right-aligned in the proforma account block" onChange={(v) => patch({ legalNameAr: v })} />
      <TextField label="Tagline" value={profile.tagline} onChange={(v) => patch({ tagline: v })} />
      <LinesTextArea label="Address lines" lines={profile.addressLines} onChange={(lines) => patch({ addressLines: lines })} />
    </section>
  );
}

export function ContactSection({ profile, patch }: { profile: CompanyProfile; patch: Patch }) {
  return (
    <section className={SECTION_CLASS}>
      <h2 className={HEADING_CLASS}>Contact &amp; fiscal</h2>
      <LinesTextArea label="Phone numbers" lines={profile.phone} onChange={(lines) => patch({ phone: lines })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Mobile" value={profile.mobile} onChange={(v) => patch({ mobile: v })} />
        <TextField label="Email" type="email" value={profile.email} onChange={(v) => patch({ email: v })} />
        <TextField label="Website" value={profile.website} onChange={(v) => patch({ website: v })} />
        <TextField label="VAT number" value={profile.vatNo} onChange={(v) => patch({ vatNo: v })} />
        <TextField label="C.R. number" value={profile.crNo} onChange={(v) => patch({ crNo: v })} />
      </div>
    </section>
  );
}

export function BankSection({ profile, patch }: { profile: CompanyProfile; patch: Patch }) {
  return (
    <section className={SECTION_CLASS}>
      <h2 className={HEADING_CLASS}>Bank (proforma)</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Bank name" value={profile.bankName} onChange={(v) => patch({ bankName: v })} />
        <TextField label="IBAN / AC" value={profile.iban} onChange={(v) => patch({ iban: v })} />
        <TextField label="SWIFT" value={profile.swift} onChange={(v) => patch({ swift: v })} />
        <TextField label="Account no. (optional)" value={profile.accountNo ?? ''} onChange={(v) => patch({ accountNo: v })} />
      </div>
    </section>
  );
}

export function SignatorySection({ profile, patchSig }: { profile: CompanyProfile; patchSig: PatchSig }) {
  return (
    <section className={SECTION_CLASS}>
      <h2 className={HEADING_CLASS}>Signatory</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Name" value={profile.signatory.name} onChange={(v) => patchSig({ name: v })} />
        <TextField label="Title" value={profile.signatory.title} onChange={(v) => patchSig({ title: v })} />
        <TextField label="Mobile" value={profile.signatory.mobile} onChange={(v) => patchSig({ mobile: v })} />
        <TextField label="Email" type="email" value={profile.signatory.email} onChange={(v) => patchSig({ email: v })} />
      </div>
    </section>
  );
}

export function BrandMarksSection({
  profile,
  assets,
  assetError,
  onPick,
  onReset,
}: {
  profile: CompanyProfile;
  assets: BrandAssets;
  assetError: string;
  onPick: (kind: AssetKind, file: File | undefined) => void;
  onReset: () => void;
}) {
  return (
    <section className={SECTION_CLASS}>
      <div className="flex items-center justify-between gap-2">
        <h2 className={HEADING_CLASS}>Brand marks</h2>
        <button
          type="button"
          onClick={onReset}
          className="rounded border border-neutral-400 px-3 py-1 text-xs hover:bg-neutral-100"
        >
          Reset to bundled crops
        </button>
      </div>
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
    </section>
  );
}
