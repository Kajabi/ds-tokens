import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.{js,mjs}'],
    // These are plain assertions over committed generated files — no DOM, no setup.
    environment: 'node',
  },
});
