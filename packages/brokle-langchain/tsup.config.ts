import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  minify: false,
  outDir: 'dist',
  external: ['brokle', 'langchain', '@opentelemetry/api'],
  target: 'node18',
  platform: 'node',
});