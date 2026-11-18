/**
 * wizard/library.ts — client-side reuse seam for saved client profiles, sign-off
 * blocks, and server-backed drafts (#11 slice 3 / multi-drafts slice).
 *
 * Thin fetch wrappers over /api/clients, /api/signoff-blocks and /api/drafts for
 * the wizard UI. Same discipline as wizard/telemetry.ts:
 *  - Best-effort: reads resolve to [] and writes never throw, so a failing or absent
 *    network call can't break navigation, autofill, or export.
 *  - Session-checked first: better-auth's client getSession answers from local state, so
 *    an anonymous/unconfigured run makes ZERO API calls instead of firing doomed 401s.
 *
 * Lives under src/wizard (not the deterministic core), so fetch never leaks into the
 * render path (AC-24/AC-28). Types mirror the server shapes in src/db/clients.ts and
 * src/db/signoff.ts.
 */
import { getSession } from '@/auth/client';
import type { Client, Closing, CompanyProfile, QuoteDocument } from '@/domain/types';
import type { WizardStep } from '@/lib/storage';

export type StoredClient = { id: string; name: string; custId: string; data: Client; updatedAt: string };
export type StoredSignoff = { id: string; label: string | null; data: Closing; updatedAt: string };
// Draft shapes mirror the server types in src/db/drafts.ts (list summaries stay
// light; only the single-draft read carries the full doc for wizard hydration).
export type StoredDraftSummary = {
  id: string;
  name: string;
  kind: string;
  number: string | null;
  clientName: string | null;
  step: WizardStep;
  updatedAt: string;
};
export type StoredDraft = StoredDraftSummary & { doc: QuoteDocument };

/** True only when there is an authenticated session (else callers skip every request). */
async function authed(): Promise<boolean> {
  try {
    const { data } = await getSession();
    return Boolean((data as { user?: unknown } | null)?.user);
  } catch {
    return false;
  }
}

/** GET a JSON list endpoint, or [] on any non-2xx / network failure (best-effort). */
async function readList<T>(url: string): Promise<T[]> {
  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) return [];
    const json = (await res.json()) as { items?: T[] };
    return Array.isArray(json.items) ? json.items : [];
  } catch {
    return [];
  }
}

/** POST/PUT/PATCH/DELETE fire-and-forget; returns whether the request was accepted (best-effort). */
async function write(url: string, method: 'POST' | 'PUT' | 'PATCH', body: unknown): Promise<boolean>;
async function write(url: string, method: 'DELETE'): Promise<boolean>;
async function write(url: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method,
      ...(body !== undefined ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchClients(): Promise<StoredClient[]> {
  if (!(await authed())) return [];
  return readList<StoredClient>('/api/clients');
}

export async function saveClient(client: Client): Promise<boolean> {
  if (!(await authed())) return false;
  return write('/api/clients', 'POST', client);
}

export async function removeClient(id: string): Promise<boolean> {
  if (!(await authed())) return false;
  return write(`/api/clients/${encodeURIComponent(id)}`, 'DELETE');
}

export async function fetchSignoffs(): Promise<StoredSignoff[]> {
  if (!(await authed())) return [];
  return readList<StoredSignoff>('/api/signoff-blocks');
}

export async function saveSignoff(block: Closing): Promise<boolean> {
  if (!(await authed())) return false;
  return write('/api/signoff-blocks', 'POST', block);
}

export async function removeSignoff(id: string): Promise<boolean> {
  if (!(await authed())) return false;
  return write(`/api/signoff-blocks/${encodeURIComponent(id)}`, 'DELETE');
}

/**
 * Fetch the next sequence number for the given template (wizard doc-number split,
 * slice 2). Resolves to the digit string the server computed (max(seq) + 1 for the
 * signed-in user's prior documents of the same kind), or null when the request
 * cannot be satisfied (anonymous / unconfigured / network error / malformed body)
 * — callers fall back to the factory default. Session-checked first like the rest
 * of the library so an anonymous wizard run makes zero API calls on mount.
 */
export async function fetchNextSeq(template: 'quotation' | 'proforma'): Promise<string | null> {
  if (!(await authed())) return null;
  try {
    const res = await fetch(`/api/documents/next-number?template=${template}`, { method: 'GET' });
    if (!res.ok) return null;
    const json = (await res.json()) as { seq?: unknown };
    return typeof json.seq === 'string' ? json.seq : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Multi-drafts (server-backed, user-scoped)
// ---------------------------------------------------------------------------

/**
 * The user's saved drafts, freshest first (list rows only — no docs). Resolves to
 * [] when signed out / unreachable, so the pickers simply render nothing.
 */
export async function fetchDrafts(limit?: number): Promise<StoredDraftSummary[]> {
  if (!(await authed())) return [];
  return readList<StoredDraftSummary>(`/api/drafts${limit ? `?limit=${limit}` : ''}`);
}

/** Open one draft with its full doc, or null (signed out / 404 / network). */
export async function fetchDraft(id: string): Promise<StoredDraft | null> {
  if (!(await authed())) return null;
  try {
    const res = await fetch(`/api/drafts/${encodeURIComponent(id)}`, { method: 'GET' });
    if (!res.ok) return null;
    const json = (await res.json()) as { draft?: StoredDraft };
    return json.draft ?? null;
  } catch {
    return null;
  }
}

/**
 * Create (id null/undefined) or refresh a draft. Resolves to the tracked identity
 * + server-derived title, or null when signed out / unreachable / rejected — the
 * wizard surfaces the outcome as a toast and never blocks editing.
 */
export async function persistDraft(args: {
  id: string | null;
  step: WizardStep;
  doc: QuoteDocument;
}): Promise<{ id: string; name: string } | null> {
  if (!(await authed())) return null;
  try {
    const res = await fetch('/api/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(args.id ? { id: args.id, step: args.step, doc: args.doc } : { step: args.step, doc: args.doc }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean; id?: string | null; name?: string };
    if (!json.ok || typeof json.id !== 'string') return null;
    return { id: json.id, name: typeof json.name === 'string' ? json.name : '' };
  } catch {
    return null;
  }
}

export async function removeDraft(id: string): Promise<boolean> {
  if (!(await authed())) return false;
  return write(`/api/drafts/${encodeURIComponent(id)}`, 'DELETE');
}

// ---------------------------------------------------------------------------
// Server-backed company profile + brand marks (#38)
// ---------------------------------------------------------------------------

/** The two brand-mark overrides that ride alongside the profile (null = bundled crop). */
export type ProfileAssetPair = { headerMark: string | null; footerMark: string | null };
/** A stored server profile: the validated CompanyProfile plus its mark overrides. */
export type ServerProfile = { profile: CompanyProfile; assets: ProfileAssetPair; setupComplete: boolean };

/**
 * The signed-in user's active server profile + brand marks, or null when there is no
 * session / the server has none stored yet / the request fails. Callers read null as
 * "fall back to the device-local profile / defaults", mirroring the creds-guarded
 * degradation of the draft/client reads. Session-checked first so an anonymous run
 * makes zero API calls.
 */
export async function fetchProfile(): Promise<ServerProfile | null> {
  if (!(await authed())) return null;
  try {
    const res = await fetch('/api/profile', { method: 'GET' });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      profile?: CompanyProfile | null;
      assets?: ProfileAssetPair | null;
      setupComplete?: unknown;
    };
    if (!json.profile) return null;
    return {
      profile: json.profile,
      assets: json.assets ?? { headerMark: null, footerMark: null },
      setupComplete: json.setupComplete === true,
    };
  } catch {
    return null;
  }
}

/**
 * Upsert the signed-in user's active server profile + marks (best-effort PUT). Returns
 * whether the request was accepted; a rejected/absent network call never throws into the
 * Settings save path. Session-checked first like the rest of the library. `completeSetup`
 * (#37) sets the onboarding marker only when explicitly passed, so ordinary saves leave it.
 */
export async function saveProfileServer(
  profile: CompanyProfile,
  assets: ProfileAssetPair,
  opts?: { completeSetup?: boolean },
): Promise<boolean> {
  if (!(await authed())) return false;
  try {
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(
        opts?.completeSetup !== undefined
          ? { profile, assets, setupComplete: opts.completeSetup }
          : { profile, assets },
      ),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Company-profile LIBRARY (#31 part 1)
//
// The set of saved, user-scoped profiles behind the Settings "my profiles" manager and the
// per-quote picker. Same discipline as above: session-checked first (an anonymous run makes
// ZERO calls and gets []/null so the UI falls back to the single device-local profile), and
// every call is best-effort (never throws into the wizard/Settings). These talk to the plural
// /api/profiles endpoints and LEAVE the singular /api/profile (active-profile) seam intact.
// ---------------------------------------------------------------------------

/** A library row header for list/picker rendering (no payload / marks). */
export type StoredProfileSummary = { id: string; name: string; isDefault: boolean; updatedAt: string };
/** One full library row, ready to edit or render: identity + profile + its mark overrides. */
export type LibraryProfile = ServerProfile & { id: string; name: string; isDefault: boolean };

/** The user's saved profiles (default first), or [] when signed out / unreachable. */
export async function fetchProfiles(): Promise<StoredProfileSummary[]> {
  if (!(await authed())) return [];
  return readList<StoredProfileSummary>('/api/profiles');
}

/** One full library row by id, or null (signed out / missing / foreign / error). */
export async function fetchProfileById(id: string): Promise<LibraryProfile | null> {
  if (!(await authed())) return null;
  try {
    const res = await fetch(`/api/profiles/${encodeURIComponent(id)}`, { method: 'GET' });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      id?: string;
      name?: string;
      isDefault?: boolean;
      profile?: CompanyProfile;
      assets?: ProfileAssetPair | null;
      setupComplete?: unknown;
    };
    if (!json.id || !json.profile) return null;
    return {
      id: json.id,
      name: json.name ?? '',
      isDefault: json.isDefault === true,
      profile: json.profile,
      assets: json.assets ?? { headerMark: null, footerMark: null },
      setupComplete: json.setupComplete === true,
    };
  } catch {
    return null;
  }
}

/**
 * Add a new named profile to the library ("save a copy as new"). Returns the new row id,
 * or null when signed out / unreachable / rejected.
 */
export async function createProfileServer(args: {
  name: string;
  profile: CompanyProfile;
  assets: ProfileAssetPair;
  makeDefault?: boolean;
}): Promise<string | null> {
  if (!(await authed())) return null;
  try {
    const res = await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { id?: string | null };
    return typeof json.id === 'string' ? json.id : null;
  } catch {
    return null;
  }
}

/** Patch a row (rename / update payload+marks / promote to default / set the marker). */
export async function updateProfileServer(
  id: string,
  patch: {
    name?: string;
    profile?: CompanyProfile;
    assets?: ProfileAssetPair;
    makeDefault?: boolean;
    setupComplete?: boolean;
  },
): Promise<boolean> {
  if (!(await authed())) return false;
  return write(`/api/profiles/${encodeURIComponent(id)}`, 'PATCH', patch);
}

/** Remove a row from the library. */
export async function deleteProfileServer(id: string): Promise<boolean> {
  if (!(await authed())) return false;
  return write(`/api/profiles/${encodeURIComponent(id)}`, 'DELETE');
}
