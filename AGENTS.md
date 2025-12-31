# Repository Guidelines

## Project Structure & Module Organization
Packages are managed via `pnpm-workspace.yaml`. The core tracing SDK lives in `packages/brokle/src`, provider shims reside in `packages/brokle-openai`, `packages/brokle-anthropic`, and `packages/brokle-langchain`, and all build artifacts land in each package's `dist/`. Place runnable demos under `examples/` and cross-package integration scaffolding in `tests/`. Co-locate unit tests beside implementation files (for example `src/client.test.ts`) and share utilities through explicit exports rather than deep imports.

## Build, Test, and Development Commands
Install dependencies once with `pnpm install` at the repo root. `pnpm build` calls `tsup` across every package to refresh `dist/`. Use `pnpm dev` for watch mode while iterating. `pnpm test` runs Vitest suites; narrow scope with `pnpm --filter brokle-openai test`. Enforce static guarantees via `pnpm lint`, `pnpm typecheck`, and `pnpm format:check`. When fixing formatting, run `pnpm format`.

## Coding Style & Naming Conventions
Code is TypeScript-first targeting Node 20+ and ESM. Prettier enforces two-space indentation, 100-character lines, and trailing commas; do not hand-format around it. ESLint (with `@typescript-eslint`) is authoritative—address warnings or justify them inline. Use `camelCase` for functions, `PascalCase` for types and classes, and `SCREAMING_SNAKE_CASE` for environment constants. Module entry points should export named APIs from `index.ts`; reserve `default` exports for facades.

## Testing Guidelines
Vitest is the primary test runner. Name specs `*.test.ts` and structure them with `describe` and `it` blocks that mirror the public API surface. Prefer constructing fixtures via helper factories under `src/__support__/` when mocks get complex. Aim for coverage that exercises happy-path and failure telemetry; flag intentional gaps in the PR description. Use `pnpm --filter <package> test:watch` for TDD loops.

## Commit & Pull Request Guidelines
Follow the informal `<type>: <summary>` message pattern (for example `feat: add LangChain span bridge`); keep the subject under 72 characters and write body context when behavior changes. Branch names should reflect intent (`feature/otel-exporter`). Before opening a PR, ensure build, lint, typecheck, and tests pass and include their status in the description. Reference related issues, document breaking changes, and attach console output or screenshots for developer-facing regressions. Request review from a maintainer familiar with the touched package.

## Security & Configuration Tips
Do not commit provider credentials; read them from environment variables and document expected names in package READMEs. When capturing telemetry, scrub PII before exporting traces. Use gitignored `.env.local` files for local secrets and share sanitized snippets in docs.
