import { defineConfig } from 'tsup';

// Production build for the API server.
// - Bundles the `@dlpe/shared` workspace package (it ships raw .ts, so a plain
//   `tsc` would not produce a runnable standalone artifact) via `noExternal`.
// - Keeps node_modules dependencies (express, @prisma/client, argon2, ...)
//   external so they resolve from the installed node_modules at runtime —
//   notably argon2 and @prisma/client have native/engine binaries.
export default defineConfig({
  entry: ['src/index.ts', 'src/scripts/bootstrap-admin.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // Inline the raw-TS workspace package; everything else stays external.
  noExternal: ['@dlpe/shared'],
  // tsup/esbuild bundles by default; we only want the workspace pkg inlined.
  // Mark all other deps external so they load from node_modules at runtime.
  skipNodeModulesBundle: true,
});
