/**
 * wizard/telemetry.ts — fire-and-forget activity logging for the wizard (#10 slice 2).
 *
 * Wraps POST /api/events for the UI layer. Discipline:
 *  - Best-effort: nothing here ever throws or surfaces to the user — telemetry must
 *    not break an export. Every failure path resolves quietly.
 *  - Session-checked first: better-auth's client getSession answers from local state
 *    when auth is unconfigured, so anonymous/unconfigured runs make zero API calls
 *    instead of firing requests doomed to 401.
 *
 * Lives under src/wizard, not src/lib, so the deterministic core (src/lib|domain|pdf)
 * stays pure and fetch never leaks into the render path (AC-24/AC-28).
 */
import { getSession } from '@/auth/client';

/** Client-side mirror of the server vocabulary in src/db/activities.ts. */
export type ActivityKind = 'exported' | 'draft_saved' | 'snapshot_saved' | 'document_saved';
export type ActivityDocKind = 'quotation' | 'proforma';

export async function logActivity(
  kind: ActivityKind,
  opts?: { docKind?: ActivityDocKind; documentId?: string; payload?: unknown },
): Promise<void> {
  try {
    const { data } = await getSession();
    const user = (data as { user?: unknown } | null)?.user;
    if (!user) return;

    await fetch('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind,
        docKind: opts?.docKind ?? null,
        documentId: opts?.documentId ?? null,
        ...(opts?.payload !== undefined ? { payload: opts.payload } : {}),
      }),
    });
  } catch {
    // Best-effort by contract: logging failures are silently ignored.
  }
}
