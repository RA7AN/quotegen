/**
 * wizard/library.ts — client-side reuse seam for saved client profiles & sign-off
 * blocks (#11 slice 3).
 *
 * Thin fetch wrappers over /api/clients and /api/signoff-blocks for the wizard UI.
 * Same discipline as wizard/telemetry.ts:
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
import type { Client, Closing } from '@/domain/types';

export type StoredClient = { id: string; name: string; custId: string; data: Client; updatedAt: string };
export type StoredSignoff = { id: string; label: string | null; data: Closing; updatedAt: string };

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
