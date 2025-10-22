import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/constants.ts', 'src/schemas.ts', 'src/types.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'node20',
});
