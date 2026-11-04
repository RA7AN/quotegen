import { describe, expect, it } from 'vitest';
import * as route from './route';

// Proves the auth catch-all is build/CI-safe: importing it must not construct Better
// Auth (the handler is built lazily per request), and it exposes the verbs Better
// Auth's client calls. Lives under src/app/api/** so AC-24's route boundary holds.
describe('api/auth/[...all] route (#9)', () => {
  it('exports the HTTP verb handlers Better Auth uses', () => {
    for (const verb of ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] as const) {
      expect(typeof route[verb]).toBe('function');
    }
  });

  it('is force-dynamic (auth endpoints are never prerendered)', () => {
    expect(route.dynamic).toBe('force-dynamic');
  });
});
