import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // tsconfig keeps jsx: 'preserve' for Next; the test pipeline (Vite 8 / oxc) must
  // transform JSX itself, otherwise rolldown chokes on .tsx sources.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    // Node stays the default (the deterministic core + API-route tests need it and
    // must stay Node-only per AC-28). Component tests opt into jsdom per-file with a
    // `// @vitest-environment jsdom` docblock, so no global environment flip.
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['src/test/dom-setup.ts'],
  },
});
