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
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
  },
});
