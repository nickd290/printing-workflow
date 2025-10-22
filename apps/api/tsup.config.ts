import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  platform: 'node',
  target: 'node20',
  format: ['esm'],          // Use ESM (needed for top-level await)
  splitting: false,         // Avoid dynamic chunks
  shims: false,             // Don't polyfill Node.js modules
  sourcemap: true,
  clean: true,
  dts: false,
  // Don't bundle Node built-ins, AWS SDK, or local packages
  // Let Node resolve them at runtime to avoid bundling issues
  external: [
    /^@aws-sdk\//,
    /^@aws\//,
    '@printing-workflow/db',
    '@printing-workflow/shared',
    '@prisma/client',
    'async_hooks',
    'fs',
    'path',
    'url',
    'crypto',
    'stream',
    'http',
    'https',
    'zlib',
    'buffer',
    'util',
    'events',
  ],
  // Ensure proper ESM output
  banner: {
    js: `import { createRequire } from 'module';
const require = createRequire(import.meta.url);`,
  },
});
