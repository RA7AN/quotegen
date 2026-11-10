/**
 * app/(app)/settings/page.tsx — server route for `/settings`.
 *
 * Session guard already runs in `(app)/layout.tsx`; the profile editor itself reads
 * localStorage and mutates React state, so it lives in `./settings-view` as a client
 * component and is mounted from here.
 */

import type { Metadata } from 'next';
import { SettingsView } from './settings-view';

export const metadata: Metadata = { title: 'Company settings — Quotegen' };

export default function SettingsRoute() {
  return <SettingsView />;
}
