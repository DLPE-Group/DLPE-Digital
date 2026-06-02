import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/api/**/*.test.mjs'],
    globalSetup: ['tests/global-setup.mjs'],
    testTimeout: 20000,
    hookTimeout: 60000,
    fileParallelism: false, // share one server + DB; avoid cross-file races
    reporters: 'verbose',
  },
});
