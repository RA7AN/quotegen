/**
 * app/(app)/new/page.tsx — the wizard (client). Metadata is static; the wizard itself
 * only touches localStorage inside effects, so the shell is deterministic. Session guard
 * lives in the sibling (app)/layout.tsx.
 *
 * Multi-drafts slice: a compact "Your drafts" picker sits above the wizard (it hides
 * itself when the account has none), and the wizard reads ?draft=<id> to open one —
 * useSearchParams needs a Suspense boundary at the page level for the build.
 */

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DraftsStrip } from '@/drafts/drafts-strip';
import { Wizard } from '@/wizard/wizard';

export const metadata: Metadata = { title: 'New quote — Quotegen' };

export default function NewPage() {
  return (
    <>
      <div className="mx-auto max-w-5xl px-4 pt-6">
        <DraftsStrip max={4} title="Your drafts" hrefAll="/drafts" />
      </div>
      <Suspense fallback={null}>
        <Wizard />
      </Suspense>
    </>
  );
}
