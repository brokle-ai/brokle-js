# Repository Guidelines

## Project Structure & Module Organization
This is a single-package SDK (`brokle`) with sub-path exports. The core tracing SDK lives in `src/`, provider integrations reside in `src/integrations/openai`, `src/integrations/anthropic`, and `src/integrations/langchain`, and build artifacts land in `dist/`. Place runnable demos under `examples/`. Co-locate unit tests beside implementation files (for example `src/client.test.ts`) and share utilities through explicit exports rather than deep imports.

## Build, Test, and Development Commands
Install dependencies once with `pnpm install` at the repo root. `pnpm build` calls `tsup` across every package to refresh `dist/`. Use `pnpm dev` for watch mode while iterating. `pnpm test` runs Vitest suites; narrow scope with `pnpm --filter brokle test`. Enforce static guarantees via `pnpm lint`, `pnpm typecheck`, and `pnpm format:check`. When fixing formatting, run `pnpm format`.

## Coding Style & Naming Conventions
Code is TypeScript-first targeting Node 20+ and ESM. Prettier enforces two-space indentation, 100-character lines, and trailing commas; do not hand-format around it. ESLint (with `@typescript-eslint`) is authoritative—address warnings or justify them inline. Use `camelCase` for functions, `PascalCase` for types and classes, and `SCREAMING_SNAKE_CASE` for environment constants. Module entry points should export named APIs from `index.ts`; reserve `default` exports for facades.

## Testing Guidelines
Vitest is the primary test runner. Name specs `*.test.ts` and structure them with `describe` and `it` blocks that mirror the public API surface. Prefer constructing fixtures via helper factories under `src/__support__/` when mocks get complex. Aim for coverage that exercises happy-path and failure telemetry; flag intentional gaps in the PR description. Use `pnpm --filter <package> test:watch` for TDD loops.

## Compatibility Notes
- Backward compatibility is not required yet; there is no production data because the product has not been released.

## Commit & Pull Request Guidelines
Follow the informal `<type>: <summary>` message pattern (for example `feat: add LangChain span bridge`); keep the subject under 72 characters and write body context when behavior changes. Branch names should reflect intent (`feature/otel-exporter`). Before opening a PR, ensure build, lint, typecheck, and tests pass and include their status in the description. Reference related issues, document breaking changes, and attach console output or screenshots for developer-facing regressions. Request review from a maintainer familiar with the touched package.

## Security & Configuration Tips
Do not commit provider credentials; read them from environment variables and document expected names in package READMEs. When capturing telemetry, scrub PII before exporting traces. Use gitignored `.env.local` files for local secrets and share sanitized snippets in docs.

## Known Gotchas

1. **Symbol.for('brokle') singleton is first-write-wins** — First `new BrokleClient()` call registers on `globalThis` via `Symbol.for('brokle')`. Subsequent calls with different configs are silently ignored. Use `setClient()` to explicitly override. This survives module reloads and bundler boundaries.
2. **AsyncLocalStorage context scoping** — `withBrokleClient()` uses `Symbol.for('brokle:context')` backed by Node's `AsyncLocalStorage`. Context is per async chain, not global. Forgetting to wrap code in `withBrokleClient()` silently uses the default singleton.
3. **Proxy pattern for wrappers** — `wrapOpenAI()`, `wrapAnthropic()` etc. return recursive `Proxy` objects that intercept `get` operations. Symbols pass through untouched (`typeof prop === 'symbol'`). Don't subclass or extend provider clients — wrap them.
4. **Multi-entry tsup build** — 11 entry points (core + 10 integrations) produce separate `.d.ts` files. Import from sub-paths: `import { wrapOpenAI } from 'brokle/openai'`, never from root `'brokle'`. Wrong import path breaks tree-shaking.
5. **Optional peer deps fail at call time, not import time** — Provider SDKs (openai, @anthropic-ai/sdk, etc.) are optional peer deps. `import { wrapOpenAI } from 'brokle/openai'` succeeds even without openai installed. The error only surfaces when `wrapOpenAI()` is called and validates `client.chat?.completions?.create`.
6. **Node >= 20 required** — `engines` field enforces Node 20+. AsyncLocalStorage and ES2023 features are used. No browser or Node 18 support without polyfills.
7. **`enabled: false` creates a no-op client** — Disabled client still registers the singleton via `Symbol.for()`, but all telemetry is discarded. No provider initialization, no resource creation.
8. **gRPC exports are optional dependencies** — `@opentelemetry/exporter-*-otlp-grpc` packages are in `optionalDependencies`. If gRPC transport is configured but packages aren't installed, export silently falls back or fails.

## Lessons Learned

- 2026-04-14: The root repo's AGENTS.md documents cross-cutting SDK gotchas (submodule workflow, singleton pattern, optional peer deps). Check it for platform-wide context before making changes.

## Compatibility Notes
- Backward compatibility is not required yet; there is no production data because the product has not been released.
