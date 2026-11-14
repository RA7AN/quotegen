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
import type { Client, Closing, QuoteDocument } from '@/domain/types';
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

/** POST/DELETE fire-and-forget; returns whether the request was accepted (best-effort). */
async function write(url: string, method: 'POST', body: unknown): Promise<boolean>;
async function write(url: string, method: 'DELETE'): Promise<boolean>;
async function write(url: string, method: 'POST' | 'DELETE', body?: unknown): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method,
      ...(method === 'POST' ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
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
