/**
 * app/(app)/drafts/page.tsx — server route for `/drafts` (multi-drafts slice).
 *
 * Session guard already runs in `(app)/layout.tsx`; this file only gives the URL a
 * route entry and hoists the page title. The list body is a client component (it
 * reads GET /api/drafts on mount), so we hand off to drafts/drafts-view.
 */

import type { Metadata } from 'next';
import { DraftsView } from '@/drafts/drafts-view';

export const metadata: Metadata = { title: 'Drafts — Quotegen' };

export default function DraftsRoute() {
  return <DraftsView />;
}
