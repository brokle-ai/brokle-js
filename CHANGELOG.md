# Changelog

All notable changes to the Brokle JavaScript SDK packages will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2024-11-16

### Initial Release

This is the first public release of the Brokle JavaScript SDK monorepo.

#### Published Packages

- **brokle** - Core OpenTelemetry-native observability SDK
- **brokle-openai** - OpenAI SDK wrapper with automatic tracing
- **brokle-anthropic** - Anthropic SDK wrapper with automatic tracing
- **brokle-langchain** - LangChain.js integration with automatic tracing

#### Features

- **brokle**: OpenTelemetry-native design with GenAI 1.28+ semantic conventions
- **brokle**: Trace-level sampling with TraceIdRatioBasedSampler
- **brokle**: Type-safe attribute constants
- **brokle**: Gzip compression (65% size reduction)
- **brokle**: Support for serverless + long-running applications
- **brokle-openai**: Auto-instrumentation for OpenAI SDK v4+
- **brokle-openai**: Streaming support with real-time span updates
- **brokle-anthropic**: Auto-instrumentation for Anthropic SDK
- **brokle-langchain**: LangChain.js callbacks integration
- **All packages**: TypeScript support with full type definitions
- **All packages**: Dual format (ESM + CommonJS)
- **All packages**: Node.js 18+ support

#### Infrastructure

- pnpm monorepo with workspace support
- tsup for fast, zero-config bundling
- Vitest for testing
- Changesets for version management
- GitHub Actions CI/CD (lint, test, typecheck, build)
- Automated npm publishing with provenance

---

## Version Links

[Unreleased]: https://github.com/brokle-ai/brokle-js/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/brokle-ai/brokle-js/releases/tag/v0.1.0

---

## Changelog Format

Changes are organized by package using the following prefixes:

- **brokle**: Core SDK changes
- **brokle-openai**: OpenAI wrapper changes
- **brokle-anthropic**: Anthropic wrapper changes
- **brokle-langchain**: LangChain integration changes

### Example Future Entry

```markdown
## [0.2.0] - 2024-11-20

### Added
- **brokle**: Added streaming support for real-time trace updates (#123)
- **brokle-openai**: Added support for function calling traces (#124)

### Changed
- **brokle**: Improved error handling for OTLP export failures (#125)
- **brokle-anthropic**: Updated to Anthropic SDK v0.18.0 (#126)

### Fixed
- **brokle**: Fixed memory leak in batch span processor (#127)
- **brokle-langchain**: Fixed callback chain for nested runs (#128)

### Breaking Changes
- **brokle**: Renamed `TracerConfig` to `BrokleConfig` for clarity
  - **Migration**: Update import: `import { BrokleConfig } from 'brokle'`
```

For detailed package-specific changes, see individual CHANGELOGs:
- [packages/brokle/CHANGELOG.md](./packages/brokle/CHANGELOG.md)
- [packages/brokle-openai/CHANGELOG.md](./packages/brokle-openai/CHANGELOG.md)
- [packages/brokle-anthropic/CHANGELOG.md](./packages/brokle-anthropic/CHANGELOG.md)
- [packages/brokle-langchain/CHANGELOG.md](./packages/brokle-langchain/CHANGELOG.md)
