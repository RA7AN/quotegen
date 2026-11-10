/**
 * app/(app)/settings/settings-view.tsx — company profile editor body (FR-5.1 / FR-5.2).
 *
 * Client body mounted by the sibling `page.tsx` server wrapper (which owns the session
 * guard). Persists to localStorage via the storage codec; "reset to factory defaults"
 * restores the seeded Encompass/Elaf profile. Logo marks are bundled assets (03 §2)
 * and are shown read-only, not editable.
 */

'use client';

import { useState } from 'react';
import { browserKV, loadProfile, resetProfile, writeProfile } from '@/lib/storage';
import { TextField, LinesTextArea } from '@/wizard/fields';
import type { CompanyProfile } from '@/domain/types';

export function SettingsView() {
  const [profile, setProfile] = useState<CompanyProfile>(() => loadProfile(browserKV()));
  const [status, setStatus] = useState('');

  const patch = (p: Partial<CompanyProfile>) => setProfile((cur) => ({ ...cur, ...p }));
  const patchSig = (p: Partial<CompanyProfile['signatory']>) =>
    setProfile((cur) => ({ ...cur, signatory: { ...cur.signatory, ...p } }));

  const save = () => {
    writeProfile(browserKV(), profile);
    setStatus('Profile saved — new documents will use it.');
  };
  const reset = () => {
    setProfile(resetProfile(browserKV()));
    setStatus('Restored the factory Encompass/Elaf profile.');
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Company profile</h1>
        <div className="flex gap-2">
          <button type="button" onClick={reset} className="rounded border border-neutral-400 px-3 py-1.5 text-sm hover:bg-neutral-100">
            Reset to factory defaults
          </button>
          <button type="button" onClick={save} className="rounded bg-black px-4 py-1.5 text-sm font-semibold text-white hover:bg-neutral-800">
            Save
          </button>
        </div>
      </div>
      {status && <p role="status" aria-live="polite" className="text-sm text-muted">{status}</p>}

      <section className="space-y-4 rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Identity</h2>
        <TextField label="Legal name (EN)" value={profile.legalNameEn} onChange={(v) => patch({ legalNameEn: v })} />
        <TextField label="Legal name (AR)" value={profile.legalNameAr ?? ''} hint="Printed right-aligned in the proforma account block" onChange={(v) => patch({ legalNameAr: v })} />
        <TextField label="Tagline" value={profile.tagline} onChange={(v) => patch({ tagline: v })} />
        <LinesTextArea label="Address lines" lines={profile.addressLines} onChange={(lines) => patch({ addressLines: lines })} />
      </section>

      <section className="space-y-4 rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Contact &amp; fiscal</h2>
        <LinesTextArea label="Phone numbers" lines={profile.phone} onChange={(lines) => patch({ phone: lines })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Mobile" value={profile.mobile} onChange={(v) => patch({ mobile: v })} />
          <TextField label="Email" type="email" value={profile.email} onChange={(v) => patch({ email: v })} />
          <TextField label="Website" value={profile.website} onChange={(v) => patch({ website: v })} />
          <TextField label="VAT number" value={profile.vatNo} onChange={(v) => patch({ vatNo: v })} />
          <TextField label="C.R. number" value={profile.crNo} onChange={(v) => patch({ crNo: v })} />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Bank (proforma)</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Bank name" value={profile.bankName} onChange={(v) => patch({ bankName: v })} />
          <TextField label="IBAN / AC" value={profile.iban} onChange={(v) => patch({ iban: v })} />
          <TextField label="SWIFT" value={profile.swift} onChange={(v) => patch({ swift: v })} />
          <TextField label="Account no. (optional)" value={profile.accountNo ?? ''} onChange={(v) => patch({ accountNo: v })} />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Signatory</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Name" value={profile.signatory.name} onChange={(v) => patchSig({ name: v })} />
          <TextField label="Title" value={profile.signatory.title} onChange={(v) => patchSig({ title: v })} />
          <TextField label="Mobile" value={profile.signatory.mobile} onChange={(v) => patchSig({ mobile: v })} />
          <TextField label="Email" type="email" value={profile.signatory.email} onChange={(v) => patchSig({ email: v })} />
        </div>
      </section>

      <section className="space-y-2 rounded-lg border border-neutral-200 p-4 text-sm">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted">Brand marks (bundled assets)</h2>
        <p className="text-muted">Header: {profile.logos.headerMark} · Footer: {profile.logos.footerMark}</p>
      </section>
    </main>
  );
}
