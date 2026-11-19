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
 *
 * #49 (tap targets only): the action buttons and the saved-profile library rows measured 16–34 px
 * tall at 390 px — `Edit`/`Delete` were bare `text-xs` underlined links inside a list whose Delete
 * destroys a letterhead. They are now 44 px controls. The form's field sizing, section spacing and
 * the 2 640 px page height stay with #50, which owns the settings/wizard form layout.
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
import {
  fetchProfile,
  saveProfileServer,
  fetchProfiles,
  fetchProfileById,
  createProfileServer,
  updateProfileServer,
  deleteProfileServer,
  type StoredProfileSummary,
} from '@/wizard/library';
import { FloatingToast, FloatingToastStack } from '@/wizard/fields';
import { ConfirmDialog } from '@/wizard/confirm-dialog';
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
  // #31 part 1: the saved-profile library + which row the editor is bound to. `editingId`
  // is null for a not-yet-saved device profile (anonymous / pre-library), in which case
  // writes fall back to the singular active-profile PUT exactly as before #31.
  const [library, setLibrary] = useState<StoredProfileSummary[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('Company profile');
  const [pendingDelete, setPendingDelete] = useState<StoredProfileSummary | null>(null);

  const patch = (p: Partial<CompanyProfile>) => setProfile((cur) => ({ ...cur, ...p }));
  const patchSig = (p: Partial<CompanyProfile['signatory']>) =>
    setProfile((cur) => ({ ...cur, signatory: { ...cur.signatory, ...p } }));

  // #31 part 1: route every profile+marks write through here. When the editor is bound to a
  // library row (`editingId`) we PATCH that row; otherwise (anonymous / a not-yet-saved device
  // profile) we fall back to the singular active-profile PUT exactly as before #31 — so the
  // offline / signed-out save→storage path is unchanged. Local cache always gets the profile.
  const persistTo = (nextProfile: CompanyProfile, nextAssets: BrandAssets) => {
    writeProfile(browserKV(), nextProfile);
    const marks = { headerMark: nextAssets.headerMark, footerMark: nextAssets.footerMark };
    if (editingId) void updateProfileServer(editingId, { profile: nextProfile, assets: marks });
    else void saveProfileServer(nextProfile, marks);
  };

  const save = () => {
    persistTo(profile, assets);
    setStatus('Profile saved — new documents will use it.');
  };
  const reset = () => {
    const fresh = resetProfile(browserKV());
    setProfile(fresh);
    persistTo(fresh, assets);
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
      const nextAssets: BrandAssets = { ...assets, [kind]: dataUrl };
      setAssets(nextAssets);
      // Uploads keep bytes OUT of the profile slot (assets slot only) — sync the mark to the
      // server without rewriting local profile storage (#5 invariant the tests assert).
      const marks = { headerMark: nextAssets.headerMark, footerMark: nextAssets.footerMark };
      if (editingId) void updateProfileServer(editingId, { profile, assets: marks });
      else void saveProfileServer(profile, marks);
      setStatus('Brand mark updated — new documents will use it.');
    } catch {
      setAssetError('That image could not be read.');
    }
  };

  const resetAssetUi = () => {
    resetAssets(browserKV());
    const cleared = loadBrandAssets(browserKV());
    setAssets(cleared);
    if (editingId) void updateProfileServer(editingId, { profile, assets: { headerMark: null, footerMark: null } });
    else void saveProfileServer(profile, { headerMark: null, footerMark: null });
    setAssetError('');
    setStatus('Restored the bundled brand marks.');
  };

  // #31 manager handlers — load / save-as / rename / promote / delete library rows.
  const refreshLibrary = async (): Promise<StoredProfileSummary[]> => {
    const summaries = await fetchProfiles();
    setLibrary(summaries);
    return summaries;
  };
  const openProfile = async (id: string) => {
    const row = await fetchProfileById(id);
    if (!row) {
      setStatus('That saved profile could not be loaded.');
      return;
    }
    setEditingId(row.id);
    setEditingName(row.name);
    setProfile(row.profile);
    writeProfile(browserKV(), row.profile);
    writeAsset(browserKV(), 'headerMark', row.assets.headerMark);
    writeAsset(browserKV(), 'footerMark', row.assets.footerMark);
    setAssets((cur) => ({ ...cur, headerMark: row.assets.headerMark, footerMark: row.assets.footerMark }));
    setStatus(`Editing “${row.name || '(unnamed)'}” — changes save to this profile.`);
  };
  const saveAsNew = async () => {
    const id = await createProfileServer({
      name: editingName.trim() || 'Company profile',
      profile,
      assets: { headerMark: assets.headerMark, footerMark: assets.footerMark },
    });
    if (!id) {
      setStatus('Sign in to save a copy of this profile.');
      return;
    }
    setEditingId(id);
    await refreshLibrary();
    setStatus('Saved a new profile to your library.');
  };
  const renameCurrent = async () => {
    if (!editingId) return;
    const name = editingName.trim();
    if (!name) return;
    await updateProfileServer(editingId, { name });
    await refreshLibrary();
    setStatus('Profile renamed.');
  };
  const makeDefault = async (id: string) => {
    await updateProfileServer(id, { makeDefault: true });
    await refreshLibrary();
    setStatus('Default profile updated — new documents use it.');
  };
  const confirmDelete = async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    await deleteProfileServer(target.id);
    const summaries = await refreshLibrary();
    if (editingId === target.id) {
      setEditingId(null);
      setEditingName('Company profile');
      const server = await fetchProfile();
      if (server) {
        setProfile(server.profile);
        writeProfile(browserKV(), server.profile);
        setAssets((cur) => ({ ...cur, headerMark: server.assets.headerMark, footerMark: server.assets.footerMark }));
      }
    }
    // Deleting the default promotes another row — keep the picker's active row honest.
    if (target.isDefault) {
      const nextDefault = summaries.find((s) => s.isDefault);
      if (nextDefault && editingId !== nextDefault.id) setEditingId(nextDefault.id);
    }
    setStatus('Profile deleted.');
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
      } else {
        const local = readProfile(browserKV());
        if (local) {
          const localAssets = loadBrandAssets(browserKV());
          void saveProfileServer(local, { headerMark: localAssets.headerMark, footerMark: localAssets.footerMark });
        }
      }
      // #31 part 1: load the library and bind the editor to the default row when one exists,
      // so saves PATCH that row instead of the singular active-profile PUT. Anonymous runs
      // get an empty list and leave `editingId` null (the pre-#31 device-local path).
      const summaries = await fetchProfiles();
      if (!alive) return;
      setLibrary(summaries);
      const def = summaries.find((s) => s.isDefault);
      if (def) {
        setEditingId(def.id);
        setEditingName(def.name);
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
          <button type="button" onClick={reset} className="inline-flex min-h-[2.75rem] items-center rounded border border-neutral-400 px-3 text-sm hover:bg-neutral-100">
            Reset to factory defaults
          </button>
          <button type="button" onClick={save} className="inline-flex min-h-[2.75rem] items-center rounded bg-black px-4 text-sm font-semibold text-white hover:bg-neutral-800">
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

      {/* #31 part 1: the saved-profile library manager. Kept a plain <div> (not a <section>)
          so the alternating field-section tint parity is untouched. Only surfaces once rows
          exist; anonymous / unconfigured runs get an empty library and just the save-as hint. */}
      <div className="rounded border border-neutral-200 bg-neutral-50 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">My profiles</h2>
        <p className="mt-1 text-xs text-muted">
          Keep several company letterheads and switch which one prints per quote in the wizard.
        </p>
        <label className="mt-3 block text-xs font-medium text-neutral-700">
          Profile name
          <input
            type="text"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            className="mt-1 w-full max-w-sm rounded border border-neutral-300 px-2 py-1 text-sm"
          />
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void saveAsNew()}
            className="inline-flex min-h-[2.75rem] items-center rounded bg-black px-3 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Save a copy as new
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => void renameCurrent()}
              className="inline-flex min-h-[2.75rem] items-center rounded border border-neutral-400 px-3 text-sm hover:bg-neutral-100"
            >
              Rename current
            </button>
          )}
        </div>
        {library.length > 0 && (
          <ul className="mt-3 space-y-1">
            {library.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{s.name || '(unnamed)'}</span>
                  {s.isDefault && (
                    <span className="ml-1 rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                      Default
                    </span>
                  )}
                  {s.id === editingId && (
                    <span className="ml-1 text-xs font-medium text-green-700">Editing</span>
                  )}
                </span>
                {/* #49: these were bare `text-xs` underlined links (Edit 34×16, Delete 39×16) in a
                    list that includes a destructive action — now 44 px row controls. */}
                <span className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void openProfile(s.id)}
                    className="inline-flex min-h-[2.75rem] items-center rounded border border-neutral-400 px-3 text-sm hover:bg-neutral-100"
                  >
                    Edit
                  </button>
                  {!s.isDefault && (
                    <button
                      type="button"
                      onClick={() => void makeDefault(s.id)}
                      className="inline-flex min-h-[2.75rem] items-center rounded border border-neutral-400 px-3 text-sm hover:bg-neutral-100"
                    >
                      Set as default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPendingDelete(s)}
                    className="inline-flex min-h-[2.75rem] items-center rounded border border-red-300 px-3 text-sm text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

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

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this profile?"
        message={`“${pendingDelete?.name || '(unnamed)'}” will be removed from your library. This can't be undone.`}
        confirmLabel="Delete profile"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </main>
  );
}
