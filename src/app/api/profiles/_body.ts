/**
 * src/app/api/profiles/_body.ts — shared request-body parser for the profile library
 * routes (#31 part 1). Lives beside (not inside) the route handlers so both `route.ts`
 * and `[id]/route.ts` reuse one validation path without exporting a non-handler symbol
 * from a Next route module. Pure: mirrors the /api/profile PUT guard (CompanyProfileSchema
 * + the shared #5 cleanAsset mark guard) so the create/edit contract is identical.
 */
import { CompanyProfileSchema, type CompanyProfile } from '@/domain/types';
import { cleanAsset } from '@/lib/storage';

export type ParsedProfileBody =
  | { ok: true; profile: CompanyProfile; headerMark: string | null; footerMark: string | null }
  | { ok: false; error: string };

export function parseProfileBody(envelope: Record<string, unknown>): ParsedProfileBody {
  const parsed = CompanyProfileSchema.safeParse(envelope.profile);
  if (!parsed.success) return { ok: false, error: 'Invalid profile payload' };
  const assets = (envelope.assets && typeof envelope.assets === 'object' ? envelope.assets : {}) as Record<string, unknown>;
  const headerMark = assets.headerMark === undefined || assets.headerMark === null ? null : cleanAsset(assets.headerMark);
  const footerMark = assets.footerMark === undefined || assets.footerMark === null ? null : cleanAsset(assets.footerMark);
  const invalidMark =
    (assets.headerMark != null && headerMark === null) || (assets.footerMark != null && footerMark === null);
  if (invalidMark) return { ok: false, error: 'Invalid brand mark: expected an image data URL' };
  return { ok: true, profile: parsed.data as CompanyProfile, headerMark, footerMark };
}
