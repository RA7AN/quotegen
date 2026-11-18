/**
 * app/(onboarding)/onboarding/onboarding-view.tsx — guided one-time business setup (#37).
 *
 * Shown to a signed-in account whose server profile has `setupComplete = false` (the `(app)`
 * layout redirects here until it is set). It walks the same company-profile fields the full
 * Settings editor uses — reusing the shared sections in `@/profile/sections` so the two never
 * drift — but as a short, forward-only wizard ending in a single save.
 *
 * Local-first: edits live in React state and are mirrored to the device profile slot as the
 * user goes, but NOTHING is pushed to the server until Finish (or Skip). That single PUT also
 * flips the `setupComplete` marker (`saveProfileServer(..., { completeSetup: true })`), which
 * releases the `(app)` gate; we then route into the app and `refresh()` so the server layout
 * re-reads the marker. Skip is an explicit "accept the factory defaults" path, not a dead end:
 * it still writes + syncs the default profile and sets the marker, so the account is usable.
 *
 * All feedback stays inline (no native dialogs, AC-9). Brand-mark uploads run through the same
 * #5 guards as Settings; they persist locally during setup and ride along on the finish PUT.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  browserKV,
  loadBrandAssets,
  loadProfile,
  validateImageFile,
  writeAsset,
  writeProfile,
  type AssetKind,
  type BrandAssets,
} from '@/lib/storage';
import { fetchProfile, saveProfileServer } from '@/wizard/library';
import {
  readFileAsDataUrl,
  IdentitySection,
  ContactSection,
  BankSection,
  SignatorySection,
  BrandMarksSection,
} from '@/profile/sections';
import type { CompanyProfile } from '@/domain/types';

const STEPS = ['Welcome', 'Company identity', 'Contact & banking', 'Signatory & brand marks', 'Review'] as const;

export function OnboardingView() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<CompanyProfile>(() => loadProfile(browserKV()));
  const [assets, setAssets] = useState<BrandAssets>(() => loadBrandAssets(browserKV()));
  const [assetError, setAssetError] = useState('');
  const [busy, setBusy] = useState(false);

  const patch = (p: Partial<CompanyProfile>) => setProfile((cur) => ({ ...cur, ...p }));
  const patchSig = (p: Partial<CompanyProfile['signatory']>) =>
    setProfile((cur) => ({ ...cur, signatory: { ...cur.signatory, ...p } }));

  // Adopt an existing server profile if the account already has one (e.g. "Run setup again"
  // from Settings, or a partially-configured account). fetchProfile makes zero calls when
  // signed out, so preview / anonymous just keeps the device-local defaults above.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const server = await fetchProfile();
      if (alive && server) {
        setProfile(server.profile);
        setAssets((cur) => ({ ...cur, headerMark: server.assets.headerMark, footerMark: server.assets.footerMark }));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

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
    } catch {
      setAssetError('That image could not be read.');
    }
  };

  const resetAssetUi = () => {
    writeAsset(browserKV(), 'headerMark', null);
    writeAsset(browserKV(), 'footerMark', null);
    setAssets((cur) => ({ ...cur, headerMark: null, footerMark: null }));
    setAssetError('');
  };

  // Finish (and Skip) both persist locally + once to the server with the marker set, then
  // hand off to the app. A failed server PUT still navigates: in preview/unconfigured the
  // gate degrades open, and in production the layout bounces back here to retry.
  const finish = async () => {
    setBusy(true);
    writeProfile(browserKV(), profile);
    await saveProfileServer(
      profile,
      { headerMark: assets.headerMark, footerMark: assets.footerMark },
      { completeSetup: true },
    );
    router.push('/home');
    router.refresh();
  };

  const last = STEPS.length - 1;
  const next = () => setStep((s) => Math.min(s + 1, last));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <main id="onboarding-main" className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gold">
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </p>
        <div className="mt-2 flex gap-1" aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1 flex-1 rounded ${i <= step ? 'bg-gold' : 'bg-neutral-200'}`} />
          ))}
        </div>
      </div>

      {step === 0 && (
        <section className="space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-6">
          <h1 className="text-xl font-bold">Set up your business</h1>
          <p className="text-sm text-muted">
            Let&apos;s capture the issuing-company details that print on every quotation and
            proforma — your name, contact and fiscal info, bank details, authorised signatory and
            brand logos. This runs once; you can change anything later under{' '}
            <span className="font-medium text-black">Settings → Company profile</span>.
          </p>
          <p className="text-sm text-muted">
            Already using the sample Encompass / Elaf profile? Skip and you can edit it any time.
          </p>
        </section>
      )}

      {step === 1 && <IdentitySection profile={profile} patch={patch} />}

      {step === 2 && (
        <div className="space-y-6">
          <ContactSection profile={profile} patch={patch} />
          <BankSection profile={profile} patch={patch} />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <SignatorySection profile={profile} patchSig={patchSig} />
          <BrandMarksSection
            profile={profile}
            assets={assets}
            assetError={assetError}
            onPick={(kind, file) => void pickAsset(kind, file)}
            onReset={resetAssetUi}
          />
        </div>
      )}

      {step === 4 && (
        <ReviewStep profile={profile} assets={assets} />
      )}

      <div className="flex items-center justify-between gap-2 pt-2">
        <button
          type="button"
          onClick={back}
          disabled={step === 0 || busy}
          className="rounded border border-neutral-400 px-4 py-2 text-sm hover:bg-neutral-100 disabled:opacity-50"
        >
          Back
        </button>

        <div className="flex items-center gap-2">
          {step < last && (
            <button
              type="button"
              onClick={() => void finish()}
              disabled={busy}
              className="rounded px-3 py-2 text-sm text-muted hover:text-black disabled:opacity-50"
            >
              Skip for now
            </button>
          )}
          {step < last ? (
            <button
              type="button"
              onClick={next}
              disabled={busy}
              className="rounded bg-black px-5 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
            >
              {step === 0 ? 'Get started' : 'Next'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void finish()}
              disabled={busy}
              className="rounded bg-black px-5 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Finish setup'}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

/** Read-only recap of what will be saved, so the last step is a real confirmation. */
function ReviewStep({ profile, assets }: { profile: CompanyProfile; assets: BrandAssets }) {
  const rows: Array<[string, string]> = [
    ['Legal name (EN)', profile.legalNameEn],
    ['Legal name (AR)', profile.legalNameAr || '—'],
    ['Tagline', profile.tagline],
    ['Address', profile.addressLines.filter(Boolean).join(', ') || '—'],
    ['Phone', profile.phone.filter(Boolean).join(', ') || '—'],
    ['Email', profile.email],
    ['VAT number', profile.vatNo],
    ['C.R. number', profile.crNo],
    ['Bank / IBAN', [profile.bankName, profile.iban].filter(Boolean).join(' · ') || '—'],
    ['Signatory', profile.signatory.name],
    ['Brand marks', assets.headerMark || assets.footerMark ? 'Your uploaded images' : 'Bundled crops'],
  ];
  return (
    <section className="space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-6">
      <h2 className="text-lg font-bold">Review &amp; finish</h2>
      <p className="text-sm text-muted">
        Here&apos;s what will print on your documents. Finish to save — everything stays editable
        under Settings.
      </p>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-neutral-200 pb-1 text-sm">
            <dt className="text-muted">{k}</dt>
            <dd className="min-w-0 flex-1 truncate text-right font-medium text-black" title={v}>
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
