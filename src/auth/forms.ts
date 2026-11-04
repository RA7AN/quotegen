/**
 * src/auth/forms.ts — pure validators/helpers for the auth pages (#9).
 *
 * Kept UI-free and side-effect-free so they run under the node test env (no jsdom).
 * Lives under `src/auth` (server-boundary dir, outside AC-28's clock/random scan).
 * The pages call these before hitting the Better Auth client so users get inline,
 * accessible field errors instead of native dialogs (AC-9).
 */

export const MIN_PASSWORD_LENGTH = 8;

/** Returns an error string, or undefined when the email looks usable. */
export function validateEmail(email: string): string | undefined {
  const value = email.trim();
  if (!value) return 'Email is required';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return 'Enter a valid email address';
  return undefined;
}

/** Returns an error string, or undefined when the display name is usable. */
export function validateName(name: string): string | undefined {
  return name.trim() ? undefined : 'Name is required';
}

/** Returns an error string, or undefined when the password meets the minimum length. */
export function validatePassword(password: string): string | undefined {
  if (!password) return 'Password is required';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return undefined;
}

/**
 * Extract the Better Auth reset token from a `?token=` search param value (Next
 * gives string | string[] | null). Returns undefined when absent/blank.
 */
export function extractResetToken(value: string | string[] | null | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return first && first.trim() ? first : undefined;
}

/** Collapse a Better Auth client error (unknown shape) into a human message. */
export function authErrorMessage(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null) {
    const e = error as { message?: string; status?: number };
    if (e.message) return e.message;
    if (typeof e.status === 'number') return `Request failed (${e.status}). Please try again.`;
  }
  return 'Something went wrong. Please try again.';
}
