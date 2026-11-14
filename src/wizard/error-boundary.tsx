/**
 * wizard/error-boundary.tsx — last-resort crash net around the wizard body.
 *
 * A render/lifecycle throw inside the step components would otherwise unmount
 * the whole page with no way out (the historical "stuck wizard" symptom). The
 * boundary shows a fleeting-but-stable panel with the error message, one click
 * to retry the render, and one to hard-reset to Step 1 — mirroring the EC-11
 * discipline used for unreadable drafts: degrade, explain, never white-screen.
 *
 * Scope note: React boundaries only catch render/event-handler errors, not
 * failures in async callbacks (those already carry try/catch + status lines in
 * the wizard's own handlers).
 */

'use client';

import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode; onReset: () => void };
type State = { error: Error | null };

export class WizardErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }): void {
    // Full detail for the browser console; the panel only shows the message.
    console.error('[wizard] render crashed:', error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div role="alert" className="my-6 max-w-xl rounded-lg border border-red-300 bg-panel p-5 text-sm">
        <h2 className="font-bold text-red-600">The wizard hit an unexpected error</h2>
        <p className="mt-2 text-muted">
          Nothing you typed is lost — the draft autosaves every few seconds.
          <span className="mt-1 block font-mono text-xs">{error.message}</span>
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="rounded border border-neutral-400 px-3 py-1.5 font-medium hover:bg-neutral-100"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => {
              this.setState({ error: null });
              this.props.onReset();
            }}
            className="rounded bg-black px-3 py-1.5 font-semibold text-white hover:bg-neutral-800"
          >
            Reset to Step 1
          </button>
        </div>
      </div>
    );
  }
}
