import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // .claude : worktrees de sessions agent (copies du repo) — sans cette
    // exclusion, vitest ramasse leurs tests en double.
    exclude: ['node_modules', 'e2e', '.next', '.claude'],
  },
});
