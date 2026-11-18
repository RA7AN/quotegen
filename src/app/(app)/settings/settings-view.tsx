/**
 * app/(app)/settings/settings-view.tsx — company profile editor body (FR-5.1 / FR-5.2).
 *
 * Client body mounted by the sibling `page.tsx` server wrapper (which owns the session
 * guard). The active profile + brand marks are SERVER-BACKED per-user rows (#38): on
 * mount we adopt the server profile when one exists (refreshing the local cache), and if
 * the server has none but this device has a saved profile we push it up once (seed).
 * `localStorage` stays as an offline cache / first-paint fallback and the anonymous path
 * (no session / creds unconfigured) is unchanged — a single device-local profile.
 *
 * Every save / brand-mark change writes the local slot AND issues a best-effort PUT to
 * /api/profile, so the profile follows the account across devices. "Reset to factory
 * defaults" restores the seeded Encompass/Elaf profile and syncs that too. Brand marks
 * (#5) upload through the same guards but now persist server-side (in the profile row's
 * own mark columns) rather than only in the ~5 MB localStorage slot. All feedback is
 * inline — no native alert/confirm (AC-9).
 */

'use client';

import { useEffect, useId, useState } from 'react';
import {
  browserKV,
  loadBrandAssets,
  loadProfile,
  MAX_ASSET_BYTES,
  readProfile,
  resetAssets,
  resetProfile,
  validateImageFile,
  writeAsset,
  writeProfile,
  type AssetKind,
  type BrandAssets,
} from '@/lib/storage';
import { fetchProfile, saveProfileServer } from '@/wizard/library';
import { TextField, LinesTextArea, FloatingToast, FloatingToastStack } from '@/wizard/fields';
import type { CompanyProfile } from '@/domain/types';

/** Read a picked File into a base64 data URL (browser only). */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** One preview + file-picker row for a brand mark slot. */
function MarkUpload({
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

export function SettingsView() {
  const [profile, setProfile] = useState<CompanyProfile>(() => loadProfile(browserKV()));
  const [assets, setAssets] = useState<BrandAssets>(() => loadBrandAssets(browserKV()));
  const [assetError, setAssetError] = useState('');
  const [status, setStatus] = useState('');

  const patch = (p: Partial<CompanyProfile>) => setProfile((cur) => ({ ...cur, ...p }));
  const patchSig = (p: Partial<CompanyProfile['signatory']>) =>
    setProfile((cur) => ({ ...cur, signatory: { ...cur.signatory, ...p } }));

  const save = () => {
    writeProfile(browserKV(), profile);
    void saveProfileServer(profile, { headerMark: assets.headerMark, footerMark: assets.footerMark });
    setStatus('Profile saved — new documents will use it.');
  };
  const reset = () => {
    const fresh = resetProfile(browserKV());
    setProfile(fresh);
    void saveProfileServer(fresh, { headerMark: assets.headerMark, footerMark: assets.footerMark });
    setStatus('Restored the factory Encompass/Elaf profile.');
  };

  const pickAsset = async (kind: AssetKind, file: File | undefined) => {
    setAssetError('');
    if (!file) return;
    const invalid = validateImageFile(file);
    if (invalid) {
      setAssetError(invalid);
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = writeAsset(browserKV(), kind, dataUrl);
      if (!res.ok) {
        setAssetError(res.error === 'quota' ? 'Storage is full — try a smaller image.' : 'That image could not be saved.');
        return;
      }
      setAssets((cur) => ({ ...cur, [kind]: dataUrl }));
      void saveProfileServer(profile, {
        headerMark: kind === 'headerMark' ? dataUrl : assets.headerMark,
        footerMark: kind === 'footerMark' ? dataUrl : assets.footerMark,
      });
      setStatus('Brand mark updated — new documents will use it.');
    } catch {
      setAssetError('That image could not be read.');
    }
  };

  const resetAssetUi = () => {
    resetAssets(browserKV());
    setAssets(loadBrandAssets(browserKV()));
    void saveProfileServer(profile, { headerMark: null, footerMark: null });
    setAssetError('');
    setStatus('Restored the bundled brand marks.');
  };

  // Server-backed sync (#38): adopt the active server profile when one exists (and refresh
  // the local cache); otherwise, if this device has a saved profile the server doesn't, seed
  // it up once. fetchProfile makes zero calls when signed out, so the anonymous path just
  // keeps the localStorage-seeded state from the initial useState above.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const server = await fetchProfile();
      if (!alive) return;
      if (server) {
        setProfile(server.profile);
        writeProfile(browserKV(), server.profile);
        writeAsset(browserKV(), 'headerMark', server.assets.headerMark);
        writeAsset(browserKV(), 'footerMark', server.assets.footerMark);
        setAssets((cur) => ({ ...cur, headerMark: server.assets.headerMark, footerMark: server.assets.footerMark }));
        return;
      }
      const local = readProfile(browserKV());
      if (local) {
        const localAssets = loadBrandAssets(browserKV());
        void saveProfileServer(local, { headerMark: localAssets.headerMark, footerMark: localAssets.footerMark });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Auto-dismiss the status toast after 5 s.
  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(''), 5_000);
    return () => clearTimeout(t);
  }, [status]);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 [&>section:nth-of-type(even)]:bg-neutral-100">
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
      {status && <p className="sr-only" role="status" aria-live="polite">{status}</p>}

      <section className="space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Identity</h2>
        <TextField label="Legal name (EN)" value={profile.legalNameEn} onChange={(v) => patch({ legalNameEn: v })} />
        <TextField label="Legal name (AR)" value={profile.legalNameAr ?? ''} hint="Printed right-aligned in the proforma account block" onChange={(v) => patch({ legalNameAr: v })} />
        <TextField label="Tagline" value={profile.tagline} onChange={(v) => patch({ tagline: v })} />
        <LinesTextArea label="Address lines" lines={profile.addressLines} onChange={(lines) => patch({ addressLines: lines })} />
      </section>

      <section className="space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
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

      <section className="space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Bank (proforma)</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Bank name" value={profile.bankName} onChange={(v) => patch({ bankName: v })} />
          <TextField label="IBAN / AC" value={profile.iban} onChange={(v) => patch({ iban: v })} />
          <TextField label="SWIFT" value={profile.swift} onChange={(v) => patch({ swift: v })} />
          <TextField label="Account no. (optional)" value={profile.accountNo ?? ''} onChange={(v) => patch({ accountNo: v })} />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Signatory</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Name" value={profile.signatory.name} onChange={(v) => patchSig({ name: v })} />
          <TextField label="Title" value={profile.signatory.title} onChange={(v) => patchSig({ title: v })} />
          <TextField label="Mobile" value={profile.signatory.mobile} onChange={(v) => patchSig({ mobile: v })} />
          <TextField label="Email" type="email" value={profile.signatory.email} onChange={(v) => patchSig({ email: v })} />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Brand marks</h2>
          <button
            type="button"
            onClick={resetAssetUi}
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
          onPick={(file) => void pickAsset('headerMark', file)}
        />
        <MarkUpload
          label="Footer logo"
          src={assets.footerMark || profile.logos.footerMark}
          overridden={!!assets.footerMark}
          onPick={(file) => void pickAsset('footerMark', file)}
        />
        {assetError && <p role="alert" className="text-sm font-medium text-red-700">{assetError}</p>}
      </section>

      {status && (
        <FloatingToastStack>
          <FloatingToast message={status} variant="success" onDismiss={() => setStatus('')} />
        </FloatingToastStack>
      )}
    </main>
  );
}
