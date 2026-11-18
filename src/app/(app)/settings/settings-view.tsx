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

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  browserKV,
  loadBrandAssets,
  loadProfile,
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
import { FloatingToast, FloatingToastStack } from '@/wizard/fields';
import {
  readFileAsDataUrl,
  IdentitySection,
  ContactSection,
  BankSection,
  SignatorySection,
  BrandMarksSection,
} from '@/profile/sections';
import type { CompanyProfile } from '@/domain/types';

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

      <p className="text-sm text-muted">
        Prefer the guided walkthrough?{' '}
        <Link href="/onboarding" className="font-medium text-black underline hover:text-gold">
          Run setup again
        </Link>{' '}
        to step through these same fields and save at the end.
      </p>

      <IdentitySection profile={profile} patch={patch} />

      <ContactSection profile={profile} patch={patch} />

      <BankSection profile={profile} patch={patch} />

      <SignatorySection profile={profile} patchSig={patchSig} />

      <BrandMarksSection
        profile={profile}
        assets={assets}
        assetError={assetError}
        onPick={(kind, file) => void pickAsset(kind, file)}
        onReset={resetAssetUi}
      />

      {status && (
        <FloatingToastStack>
          <FloatingToast message={status} variant="success" onDismiss={() => setStatus('')} />
        </FloatingToastStack>
      )}
    </main>
  );
}
