import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/scorers/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  minify: false,
  outDir: 'dist',
  external: [
    '@opentelemetry/api',
    '@opentelemetry/sdk-trace-node',
    '@opentelemetry/sdk-trace-base',
    '@opentelemetry/exporter-trace-otlp-proto',
    '@opentelemetry/resources',
    '@opentelemetry/semantic-conventions',
  ],
  target: 'node18',
  platform: 'node',
});