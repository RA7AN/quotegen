/**
 * next.config.ts — Build-kit/02 §6.
 *
 * Serverful build (issue #13): we moved off `output: 'export'` so the app can run a
 * Node server runtime (Neon/Drizzle data layer in `src/db`, and — coming in #9 —
 * Better Auth + Resend). The deterministic PDF/calculation core (`src/lib|domain|pdf`)
 * stays pure and browser-only; AC-24 now guards that server code never leaks into it.
 *
 * Pages remain statically prerendered where possible; `images.unoptimized` is kept
 * because there is no image-optimizer server needed for the client-rendered app.
 */

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
};

export default nextConfig;
