/**
 * escape.ts — escape-then-substitute helpers (mirror of the reference `render.ts`
 * discipline). Every user-controllable string is escaped BEFORE it is interpolated
 * into any HTML surface (the on-screen wizard preview). `@react-pdf` text nodes are
 * already literal, but the same escape is applied so both surfaces share one codec
 * and hostile input can never inject markup (FR-8.1, AC-27).
 */

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape the five HTML-significant characters. Order-safe (ampersand first). */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]!);
}

/** Escape, then turn literal newlines into `<br>` (safe: newlines are added post-escape). */
export function escapeHtmlWithBreaks(text: string): string {
  return escapeHtml(text).replace(/\r\n?/g, '\n').replace(/\n/g, '<br>');
}

/**
 * Escape-then-substitute: fill `{key}` placeholders with escaped `values[key]`.
 * Structural labels around the placeholders are injected by the caller (trusted).
 * Missing keys substitute to an empty string so optional fields omit cleanly (EC-8).
 */
export function fillIn(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const raw = values[key];
    return raw === undefined ? '' : escapeHtml(raw);
  });
}

/** Same as {@link fillIn} but for the plain-text/PDF layer (no HTML, values used verbatim). */
export function fillInLiteral(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => values[key] ?? '');
}
