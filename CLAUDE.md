# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **Brokle JavaScript/TypeScript SDK** - a single npm package providing OpenTelemetry-native observability for AI applications.

**Key Features:**
- OpenTelemetry-native design with GenAI semantic conventions
- Trace-level sampling for cost-optimized observability
- Gzip compression (65% size reduction)
- Type-safe attribute constants
- Serverless + long-running app support
- Auto-instrumentation for OpenAI, Anthropic, and LangChain via sub-path exports

## Repository Structure

This is a **single-package SDK** with sub-path exports (follows LangSmith/Braintrust pattern):

```
brokle-js/
├── src/
│   ├── index.ts               # Main exports
│   ├── client.ts              # Brokle client
│   ├── config.ts              # Configuration
│   ├── exporter.ts            # OTLP exporter
│   ├── integrations/
│   │   ├── openai/            # OpenAI wrapper (brokle/openai)
│   │   ├── anthropic/         # Anthropic wrapper (brokle/anthropic)
│   │   └── langchain/         # LangChain callback (brokle/langchain)
│   ├── scorers/               # Scoring utilities (brokle/scorers)
│   ├── types/                 # TypeScript definitions
│   └── utils/                 # Utility functions
├── scripts/
│   └── release.sh             # Release automation
├── .github/workflows/         # CI/CD automation
├── package.json               # Package configuration with exports map
├── tsconfig.json              # TypeScript configuration
└── tsup.config.ts             # Multi-entry build configuration
```

## Sub-Path Exports

The SDK provides tree-shakeable sub-path imports:

```typescript
// Core SDK
import { BrokleClient, traced, getClient } from 'brokle';

// OpenAI integration
import { wrapOpenAI } from 'brokle/openai';

// Anthropic integration
import { wrapAnthropic } from 'brokle/anthropic';

// LangChain integration
import { BrokleLangChainCallback } from 'brokle/langchain';

// Scorers
import { BaseScorer } from 'brokle/scorers';
```

---

## Development Commands

### Setup
```bash
# Install dependencies
pnpm install

# Install with frozen lockfile (CI)
pnpm install --frozen-lockfile
```

### Development
```bash
# Build the package
pnpm build

# Watch mode
pnpm dev

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Lint
pnpm lint

# Type check
pnpm typecheck

# Format code
pnpm format

# Check formatting
pnpm format:check
```

### Clean
```bash
# Remove build artifacts and node_modules
pnpm clean
```

---

## Release Process

This SDK uses a shell script for releases (`scripts/release.sh`).

### Prerequisites

```bash
# 1. Ensure you're on main branch with clean working directory
git status  # Should show: "nothing to commit, working tree clean"

# 2. Verify all tests pass
pnpm test

# 3. Verify build works
pnpm build
```

### Creating a Release

```bash
# Run release script with version bump type
./scripts/release.sh patch   # 0.3.2 → 0.3.3
./scripts/release.sh minor   # 0.3.2 → 0.4.0
./scripts/release.sh major   # 0.3.2 → 1.0.0
```

### What Happens During Release

1. Validates clean git state and main branch
2. Runs tests
3. Bumps version in `package.json`
4. Creates git commit: `chore: release v{version}`
5. Creates git tag: `v{version}`
6. Pushes to GitHub
7. GitHub Actions publishes to npm

---

## Build System

### tsup Multi-Entry Configuration

The SDK uses tsup with multiple entry points for sub-path exports:

```typescript
// tsup.config.ts
export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'integrations/openai/index': 'src/integrations/openai/index.ts',
    'integrations/anthropic/index': 'src/integrations/anthropic/index.ts',
    'integrations/langchain/index': 'src/integrations/langchain/index.ts',
    'scorers/index': 'src/scorers/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  external: ['openai', '@anthropic-ai/sdk', '@langchain/core'],
});
```

### Package Exports Map

```json
{
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js", "require": "./dist/index.cjs" },
    "./openai": { "types": "./dist/integrations/openai/index.d.ts", ... },
    "./anthropic": { "types": "./dist/integrations/anthropic/index.d.ts", ... },
    "./langchain": { "types": "./dist/integrations/langchain/index.d.ts", ... },
    "./scorers": { "types": "./dist/scorers/index.d.ts", ... }
  }
}
```

---

## Peer Dependencies

Integration packages are **optional peer dependencies**:

```json
{
  "peerDependencies": {
    "@opentelemetry/api": "^1.0.0",
    "openai": "^4.0.0",
    "@anthropic-ai/sdk": "^0.30.0",
    "@langchain/core": "^0.3.0"
  },
  "peerDependenciesMeta": {
    "openai": { "optional": true },
    "@anthropic-ai/sdk": { "optional": true },
    "@langchain/core": { "optional": true }
  }
}
```

Users only install what they need:
```bash
npm install brokle openai          # For OpenAI users
npm install brokle @anthropic-ai/sdk  # For Anthropic users
```

---

## Testing Strategy

### Vitest

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# With coverage
pnpm test --coverage
```

### Test File Naming

- `*.test.ts` - Unit tests (co-located with source)
- `__tests__/` - Test directories for complex test suites

### Runtime Validation

Wrappers include runtime validation for missing dependencies:

```typescript
// Throws helpful error if openai package not installed
const openai = wrapOpenAI(new OpenAI({ apiKey: '...' }));
```

---

## Code Style

### TypeScript
- **Strict mode**: `strict: true`
- **Target**: ES2020
- **Module**: ESNext

### Formatting
```bash
pnpm format       # Apply formatting
pnpm format:check # Check formatting
```

### Linting
```bash
pnpm lint         # Check for issues
pnpm lint --fix   # Auto-fix issues
```

---

## Environment & Configuration

### Node.js Versions
- **Required**: >=20.0.0
- **Tested**: 20, 22, 24

### Environment Variables

```bash
# Brokle API configuration
BROKLE_API_KEY=your_api_key
BROKLE_BASE_URL=http://localhost:8080

# For testing
NODE_ENV=test
```

---

## Troubleshooting

### Build Failures

```bash
# Clean and rebuild
pnpm clean
pnpm install
pnpm build
```

### Type Errors

```bash
# Rebuild and restart TS server
pnpm build
# In VSCode: Cmd+Shift+P → "Restart TS Server"
```

### Missing Peer Dependencies

If users see errors about missing `openai` or `@anthropic-ai/sdk`:
```bash
# Install the required peer dependency
npm install openai  # For OpenAI users
```

---

## Architecture Decisions

### Why Single Package with Sub-Exports?

Follows the pattern used by LangSmith and Braintrust SDKs:
- **Simpler for users**: One `npm install brokle`
- **Tree-shakeable**: Only import what you use
- **Easier maintenance**: Single version to manage
- **Optional dependencies**: Don't force users to install unused SDKs

### Why tsup?

- **Fast**: esbuild-based bundler
- **Multi-entry**: Native support for sub-path exports
- **Dual Format**: ESM + CJS output
- **TypeScript**: Native .d.ts generation

### Why Vitest?

- **Fast**: Native ESM, parallel execution
- **Compatible**: Jest-compatible API
- **Modern**: First-class TypeScript support

---

## Links

- **Repository**: https://github.com/brokle-ai/brokle-js
- **npm**: https://www.npmjs.com/package/brokle
- **tsup Docs**: https://tsup.egoist.dev/
- **Vitest Docs**: https://vitest.dev/
