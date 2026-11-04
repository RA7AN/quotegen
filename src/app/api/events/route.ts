/**
 * src/app/api/events/route.ts — append an activity event (#10 slice 1).
 *
 * POST { kind, docKind?, documentId? } — the single write seam the wizard uses to
 * log generated/exported/draft activity. Session-guarded (401 when signed out or
 * auth is unconfigured, mirroring src/auth/session.ts semantics) and payload-
 * validated through a Zod boundary schema (AC-12 discipline: never trust the body).
 * Logging is best-effort: an unconfigured or failing DB returns 202 accepted-noop
 * rather than 500, so KPI telemetry can never break the user's export flow.
 */
import { z } from 'zod';
import { requireSessionUser, UnauthorizedError, type SessionUser } from '@/auth/session';
import { logEvent, EVENT_KINDS, DOC_KINDS } from '@/db/activities';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  kind: z.enum(EVENT_KINDS),
  docKind: z.enum(DOC_KINDS).nullish(),
  documentId: z.string().nullish(),
});

export async function POST(req: Request): Promise<Response> {
  let user: NonNullable<SessionUser>;
  try {
    user = await requireSessionUser(req.headers);
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    throw err;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid event payload', issues: parsed.error.issues.map((i) => i.message) }, { status: 400 });
  }

  const logged = await logEvent({
    userId: user.id,
    kind: parsed.data.kind,
    docKind: parsed.data.docKind ?? null,
    documentId: parsed.data.documentId ?? null,
  });
  return Response.json({ ok: logged }, { status: 202 });
}
