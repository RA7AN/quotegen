/**
 * app/(app)/quotes/page.tsx — server route for `/quotes`.
 *
 * Session guard already runs in `(app)/layout.tsx`; this file exists only to give the
 * URL a route entry and to hoist the page title. The list body is a client component
 * (it reads localStorage on mount), so we hand off to `./quotes-view`.
 */

import type { Metadata } from 'next';
import { QuotesView } from './quotes-view';

export const metadata: Metadata = { title: 'Saved quotes — Quotegen' };

export default function QuotesRoute() {
  return <QuotesView />;
}
