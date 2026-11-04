/**
 * src/app/api/events/route.ts — append an activity event (#10 slice 1, slice 3).
 *
 * POST { kind, docKind?, documentId?, payload? } — the single write seam the wizard
 * uses to log generated/exported/draft activity. Session-guarded (401 when signed
 * out or auth is unconfigured, mirroring src/auth/session.ts semantics) and payload-
 * validated through a Zod boundary schema (AC-12 discipline: never trust the body).
 * A 'document_saved' event may carry the full document payload: it is upserted into
 * `documents` first (the #12 re-render source) and the event links to the row id.
 * Logging is best-effort: an unconfigured or failing DB returns 202 accepted-noop
 * rather than 500, so KPI telemetry can never break the user's export flow.
 */
import { z } from 'zod';
import { requireSessionUser, UnauthorizedError, type SessionUser } from '@/auth/session';
import { logEvent, saveDocument, EVENT_KINDS, DOC_KINDS } from '@/db/activities';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  kind: z.enum(EVENT_KINDS),
  docKind: z.enum(DOC_KINDS).nullish(),
  documentId: z.string().nullish(),
  // The serialized QuoteDocument for 'document_saved' — opaque JSON here, validated
  // through QuoteDocumentSchema by the consumer (#12); only its size is guarded.
  payload: z.unknown().optional(),
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

  const { kind, docKind, documentId, payload } = parsed.data;

  // 'document_saved' with a payload persists the document row (#12 re-render
  // source) and re-links the event to the new row id; the client's echoed id is
  // stale after an upsert refresh, so the fresh one always wins.
  let linkedDocumentId = documentId ?? null;
  if (kind === 'document_saved' && payload !== undefined && docKind) {
    const number = readDocNumber(payload);
    const savedId = await saveDocument({
      userId: user.id,
      kind: docKind,
      number,
      clientName: readClientName(payload),
      payload,
    });
    linkedDocumentId = savedId ?? null;
  }

  const logged = await logEvent({
    userId: user.id,
    kind,
    docKind: docKind ?? null,
    documentId: linkedDocumentId,
  });
  return Response.json({ ok: logged, documentId: linkedDocumentId }, { status: 202 });
}

/** Defensive extracts from the opaque payload: strings or null, never throwing. */
function readDocNumber(payload: unknown): string | null {
  const meta = (payload as { meta?: { docNo?: unknown } } | null)?.meta;
  return typeof meta?.docNo === 'string' ? meta.docNo : null;
}

function readClientName(payload: unknown): string | null {
  const client = (payload as { client?: { name?: unknown } } | null)?.client;
  return typeof client?.name === 'string' ? client.name : null;
}
