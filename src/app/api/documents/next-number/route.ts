/**
 * src/app/api/documents/next-number/route.ts — the next doc-seq for a new wizard
 * document (wizard doc-number split, slice 2).
 *
 * GET /api/documents/next-number?template=quotation|proforma
 *   → 200 { seq: "6880" } — max seq the user has ever saved for this template + 1,
 *     or the factory default (6879 / 5799) when no parseable prior documents exist.
 *   → 400 { error } — missing/unknown `template` query param.
 *   → 401 { error } — anonymous / auth unconfigured.
 *
 * Same session guard + creds-guarded degradation as GET /api/documents: `nextSeqFor`
 * returns the factory default when the DB is unconfigured or the query throws, so
 * the wizard prefill stays best-effort and never blocks navigation. The route is
 * force-dynamic because the answer depends on the current user's saved documents.
 *
 * Global-per-user scope (issue): the counter is not partitioned by prefix, project,
 * or year segment; it takes the highest `seq` across all of the user's documents of
 * the same template kind and bumps by 1.
 */
import { requireSessionUser, UnauthorizedError, type SessionUser } from '@/auth/session';
import { DOC_KINDS, nextSeqFor, type DocKind } from '@/db/activities';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  let user: NonNullable<SessionUser>;
  try {
    user = await requireSessionUser(req.headers);
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    throw err;
  }

  const raw = new URL(req.url).searchParams.get('template');
  if (!raw || !(DOC_KINDS as readonly string[]).includes(raw)) {
    return Response.json(
      { error: `template must be one of: ${DOC_KINDS.join(', ')}` },
      { status: 400 },
    );
  }
  const seq = await nextSeqFor(user.id, raw as DocKind);
  return Response.json({ seq });
}
