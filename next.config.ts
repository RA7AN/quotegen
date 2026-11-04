/**
 * next.config.ts — Build-kit/02 §6.
 *
 * Pure static export: the whole app runs in the browser (localStorage + client-side
 * @react-pdf), so there is no server runtime to deploy. `output: 'export'` is the
 * encouraged Vercel shape (AC-24); it also guarantees no API routes exist.
 */

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  reactStrictMode: true,
  images: { unoptimized: true },
};

export default nextConfig;
