/**
 * src/app/api/auth/[...all]/route.ts — Better Auth request handler (#9).
 *
 * Mounted under src/app/api/** so AC-24's "routes only under api" boundary holds.
 * The handler is built lazily on the first request (authHandlers()), never at module
 * import — so `next build` collects this route without needing DATABASE_URL or
 * BETTER_AUTH_SECRET. At runtime, getAuth() throws a clear error if creds are absent.
 */
import { toNextJsHandler } from 'better-auth/next-js';
import { getAuth } from '@/auth/config';

export const dynamic = 'force-dynamic';

type Handlers = ReturnType<typeof toNextJsHandler>;
let handlers: Handlers | undefined;

function authHandlers(): Handlers {
  if (!handlers) handlers = toNextJsHandler(getAuth());
  return handlers;
}

export async function GET(req: Request): Promise<Response> {
  return authHandlers().GET(req);
}
export async function POST(req: Request): Promise<Response> {
  return authHandlers().POST(req);
}
export async function PATCH(req: Request): Promise<Response> {
  return authHandlers().PATCH(req);
}
export async function PUT(req: Request): Promise<Response> {
  return authHandlers().PUT(req);
}
export async function DELETE(req: Request): Promise<Response> {
  return authHandlers().DELETE(req);
}
