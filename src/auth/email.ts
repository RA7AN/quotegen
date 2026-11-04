/**
 * src/auth/email.ts — outbound email for auth flows (#9), via Resend.
 *
 * Creds-guarded: with no RESEND_API_KEY the sender is a no-op that logs (unless in
 * tests), so the app builds and unit tests run without SMTP creds. Real delivery —
 * plus the sender domain's SPF/DKIM — is configured in Vercel env; see .env.example.
 * Lives under `src/auth` (the allowed server boundary), never imported by the
 * deterministic core, keeping AC-24 green.
 */
import { Resend } from 'resend';

const PLACEHOLDER_MARK = 'REPLACE_ME';

/** True only when RESEND_API_KEY is present and not the shipped placeholder. */
export function isEmailConfigured(): boolean {
  const key = process.env.RESEND_API_KEY;
  return !!key && !key.includes(PLACEHOLDER_MARK);
}

let cached: Resend | undefined;
function getResend(): Resend {
  if (cached) return cached;
  cached = new Resend(process.env.RESEND_API_KEY);
  return cached;
}

export type AuthEmail = { to: string; subject: string; html: string };

/** Low-level sender used by Better Auth's email hooks. No-op when unconfigured. */
export async function sendAuthEmail({ to, subject, html }: AuthEmail): Promise<void> {
  if (!isEmailConfigured()) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`[auth/email] RESEND_API_KEY not set — skipped "${subject}" to ${to}`);
    }
    return;
  }
  const from = process.env.EMAIL_FROM ?? 'Quotegen <onboarding@resend.dev>';
  await getResend().emails.send({ from, to, subject, html });
}

/**
 * Password-reset email. Better Auth hands us the full reset URL (with token +
 * callback params); we only render and deliver it.
 */
export async function sendPasswordResetEmail({ to, url }: { to: string; url: string }): Promise<void> {
  await sendAuthEmail({
    to,
    subject: 'Reset your Quotegen password',
    html:
      `<p>A password reset was requested for <b>${to}</b>.</p>` +
      `<p><a href="${url}">Click here to reset your password</a>. This link expires in 1 hour.` +
      ` If you didn't request it, you can safely ignore this email.</p>`,
  });
}

/** Test seam: drop the memoized Resend client so tests can flip RESEND_API_KEY. */
export function __resetEmailForTests(): void {
  cached = undefined;
}
