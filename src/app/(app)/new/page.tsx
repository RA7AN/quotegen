/**
 * app/(app)/new/page.tsx — the wizard (client). Metadata is static; the wizard itself
 * only touches localStorage inside effects, so the shell is deterministic. Session guard
 * lives in the sibling (app)/layout.tsx.
 */

import type { Metadata } from 'next';
import { Wizard } from '@/wizard/wizard';

export const metadata: Metadata = { title: 'New quote — Quotegen' };

export default function NewPage() {
  return <Wizard />;
}
