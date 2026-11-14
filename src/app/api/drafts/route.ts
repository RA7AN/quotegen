/**
 * src/app/api/drafts/route.ts — server-backed multi-drafts (multi-drafts slice).
 *
 * GET  → { items: StoredDraftSummary[] } for the signed-in user, freshest first.
 *        Summaries only (name/kind/number/step/updatedAt); the doc travels on the
 *        single-draft GET so list pages stay light. `?limit=` caps the page.
 * POST { id?, step, doc } → create (no id) or refresh (id of a draft this wizard
 *        session loaded) one draft. `doc` is validated through DraftDocSchema
 *        (AC-12: never trust the client) and every identity column — title, kind,
 *        number, client — is derived SERVER-side from the validated doc, so a
 *        caller can't desync list rows from payloads. The client NEVER supplies a
 *        name: titles are auto-derived, which keeps "Save draft" one click.
 *
 * Draft validation is deliberately ONE STEP LOOSER than export: DraftDocSchema
 * keeps the structural guarantees that protect the render path (integer money/qty
 * via LineItemSchema, enums, prefaulted sections) but drops the "complete form"
 * rules (non-empty docNo/client name, valid ISO dates) — a half-typed form is
 * exactly what a draft is for. Completeness is gated by the wizard's own
 * validateStep gates + QuoteDocumentSchema at export time, as before.
 *
 * Session-guarded like the clients/sign-off routes (401 signed out) and
 * creds-guarded: an unconfigured DB returns an empty list (200) / an accepted-noop
 * (202 ok:false), so the wizard's Save-draft button can never hard-break.
 */
import { z } from 'zod';
import {
  ClosingSchema,
  CommercialsSchema,
  LineItemSchema,
  SCHEMA_VERSION,
  TermsSchema,
} from '@/domain/types';
import { requireSessionUser, UnauthorizedError, type SessionUser } from '@/auth/session';
import { listDrafts, saveDraft, draftTitle, DRAFT_LIST_LIMIT } from '@/db/drafts';

export const dynamic = 'force-dynamic';

/**
 * Lenient sibling of QuoteDocumentSchema for in-progress drafts: same field types
 * (money/qty integers stay integer-checked), but empties are legal until export.
 */
const DraftDocSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  template: z.enum(['quotation', 'proforma']).default('quotation'),
  meta: z.object({
    docNo: z.string(),
    projectSegment: z.string().optional(),
    quoteDateISO: z.string(),
    validUntilISO: z.string(),
    subject: z.string(),
    attn: z.string(),
  }),
  client: z.object({
    name: z.string(),
    addressLines: z.array(z.string()).default([]),
    custId: z.string().default(''),
    city: z.string().default(''),
    crNo: z.string().default(''),
  }),
  lines: z.array(LineItemSchema).default([]),
  commercials: CommercialsSchema.prefault({}),
  terms: TermsSchema.prefault({}),
  closing: ClosingSchema,
});

const DraftPutSchema = z.object({
  id: z.uuid().optional(),
  step: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  doc: DraftDocSchema,
});

export async function GET(req: Request): Promise<Response> {
  let user: NonNullable<SessionUser>;
  try {
    user = await requireSessionUser(req.headers);
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    throw err;
  }

  const raw = new URL(req.url).searchParams.get('limit');
  const limit = raw !== null && isPositiveNumber(raw) ? Number(raw) : DRAFT_LIST_LIMIT;
  const items = await listDrafts(user.id, limit);
  return Response.json({ items });
}

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
  const parsed = DraftPutSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid draft payload', issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  const { id, step, doc } = parsed.data;
  const savedId = await saveDraft({ userId: user.id, id, step, doc });
  // Echo the tracked identity + title so the wizard can adopt the id on first save.
  // draftTitle is the data layer's ONE derivation, reused here so the toast never
  // disagrees with the stored row.
  return Response.json({ ok: savedId !== null, id: savedId, name: draftTitle(doc) }, { status: 202 });
}

function isPositiveNumber(v: string): boolean {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}
