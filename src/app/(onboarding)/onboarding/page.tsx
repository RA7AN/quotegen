/**
 * app/(onboarding)/onboarding/page.tsx — server route for `/onboarding` (#37).
 *
 * Thin wrapper: the guided setup body reads profile state and mutates React state, so it
 * lives in `./onboarding-view` as a client component. No metadata title collision with the
 * document wizard — this is the account-setup step.
 */

import type { Metadata } from 'next';
import { OnboardingView } from './onboarding-view';

export const metadata: Metadata = { title: 'Set up your business — Quotegen' };

export default function OnboardingRoute() {
  return <OnboardingView />;
}
