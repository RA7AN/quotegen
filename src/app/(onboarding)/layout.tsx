/**
 * app/(onboarding)/layout.tsx — chrome for the one-time first-run setup wizard (#37).
 *
 * This is deliberately its OWN route group, not a child of `(app)`. The `(app)` layout's
 * first-run gate redirects to `/onboarding` until `setupComplete` is set; if onboarding
 * lived under `(app)` that redirect would target one of its own children and loop, because
 * a Next.js server layout can't see its own pathname to self-exclude. Here there is no setup
 * gate — only a quiet wordmark header + a Sign out escape hatch.
 *
 * No session guard: the flow is reached in practice via the `(app)` redirect (so a session
 * already exists), and letting an anonymous / preview visit still run the local setup path
 * is harmless — finishing writes the device profile and, when signed in, the server row.
 */

import Link from 'next/link';
import { SignOutButton } from '../(app)/sign-out-button';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b-4 border-gold bg-band px-4 py-3 text-band-ink">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <span className="text-sm font-bold uppercase tracking-widest">Quotegen</span>
          <SignOutButton />
        </div>
      </header>
      <div className="min-h-[calc(100vh-56px)] bg-panel">
        <Link href="#onboarding-main" className="sr-only focus:not-sr-only">
          Skip to setup
        </Link>
        {children}
      </div>
    </>
  );
}
