/**
 * app/recent/page.tsx — Recent documents route (#12 slice 2).
 *
 * Thin server-component shell around the client list: the fetch + re-render all happen
 * client-side (browser PDF path, same as the wizard), so this stays prerenderable and
 * never touches the DB at build time.
 */
import type { Metadata } from 'next';
import { RecentDocuments } from '@/documents/recent-documents';

export const metadata: Metadata = { title: 'Recent documents — Quotegen' };

export default function RecentPage() {
  return <RecentDocuments />;
}
