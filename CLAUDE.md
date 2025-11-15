# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **Brokle Platform JavaScript/TypeScript SDK** - a comprehensive SDK providing OpenTelemetry-native observability for AI applications built with JavaScript and TypeScript.

**Key Features:**
- OpenTelemetry-native design with GenAI semantic conventions
- Trace-level sampling for cost-optimized observability
- Gzip compression (65% size reduction)
- Type-safe attribute constants
- Serverless + long-running app support
- Auto-instrumentation for OpenAI, Anthropic, and LangChain

## Repository Structure

This is a **pnpm monorepo** with multiple packages:

```
brokle-js/
├── packages/
│   ├── brokle/              # Core SDK (0.1.0)
│   ├── brokle-openai/       # OpenAI wrapper (0.1.0)
│   ├── brokle-anthropic/    # Anthropic wrapper (0.1.0)
│   └── brokle-langchain/    # LangChain integration (0.1.0)
├── .changeset/              # Changesets configuration (version management)
├── .github/workflows/       # CI/CD automation
│   ├── ci.yml              # Lint, test, typecheck, build
│   ├── release.yml         # Automated npm publishing
│   └── integration.yml     # Integration tests
├── pnpm-workspace.yaml     # Monorepo workspace configuration
└── package.json            # Root workspace package
```

**All packages share the same version** (synchronized releases via Changesets).

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
# Build all packages
pnpm build

# Watch mode (parallel)
pnpm dev

# Run tests (all packages)
pnpm test

# Lint all packages
pnpm lint

# Type check all packages
pnpm typecheck

# Format code
pnpm format

# Check formatting
pnpm format:check
```

### Package-Specific Commands
```bash
# Work on specific package
cd packages/brokle
pnpm build
pnpm test
pnpm dev

# Or from root with filter
pnpm --filter brokle build
pnpm --filter brokle-openai test
```

### Clean
```bash
# Remove all build artifacts and node_modules
pnpm clean
```

---

## Release Process (Changesets)

This monorepo uses **Changesets** for version management and releases.

### Creating a Changeset

When you make changes that should be released:

```bash
# Create a changeset (interactive)
pnpm changeset

# Follow prompts:
# 1. Select packages changed (space to select, enter to confirm)
# 2. Select bump type: patch/minor/major
# 3. Write changelog summary
```

This creates a file in `.changeset/` with your changes.

**Changeset types**:
- **patch**: Bug fixes, small tweaks (0.1.0 → 0.1.1)
- **minor**: New features, backward compatible (0.1.0 → 0.2.0)
- **major**: Breaking changes (0.1.0 → 1.0.0)

### Release Workflow

1. **Developer makes changes** → Creates changeset → Commits
2. **Merge to main** → Changesets bot creates "Version Packages" PR
3. **Maintainer reviews "Version Packages" PR** → Merges
4. **GitHub Actions automatically**:
   - Versions packages
   - Updates CHANGELOGs
   - Publishes to npm
   - Creates git tags
   - Creates GitHub releases

### Manual Commands (for testing)

```bash
# Version packages (updates package.json and CHANGELOG.md)
pnpm version-packages

# Publish to npm (must build first)
pnpm build
pnpm release

# Dry run (test without publishing)
pnpm changeset publish --dry-run
```

---

## Package Structure

### Core Package (`packages/brokle`)

The main SDK package providing OpenTelemetry integration:

```
brokle/
├── src/
│   ├── index.ts           # Main exports
│   ├── client.ts          # Brokle client
│   ├── tracer.ts          # OpenTelemetry tracer setup
│   ├── exporter.ts        # OTLP exporter configuration
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions
├── package.json
├── tsconfig.json
├── tsup.config.ts         # Build configuration
└── vitest.config.ts       # Test configuration
```

### Wrapper Packages

**`packages/brokle-openai`**: OpenAI SDK instrumentation
**`packages/brokle-anthropic`**: Anthropic SDK instrumentation
**`packages/brokle-langchain`**: LangChain.js integration

Each wrapper:
- Auto-instruments the respective SDK
- Captures traces, spans, and metadata
- Forwards telemetry to Brokle platform

---

## Build System

### tsup Configuration

All packages use `tsup` for fast, zero-config bundling:

```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],    // Dual format
  dts: true,                 // Generate .d.ts files
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
});
```

**Output**:
- `dist/index.js` - CommonJS
- `dist/index.mjs` - ESM
- `dist/index.d.ts` - TypeScript declarations

---

## Testing Strategy

### Vitest

All packages use **Vitest** for testing:

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test --coverage
```

### Test File Naming

- `*.test.ts` - Unit tests
- `*.spec.ts` - Spec tests
- `__tests__/` - Test directories

### Writing Tests

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from './index';

describe('myFunction', () => {
  it('should do something', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });
});
```

---

## Code Style

### TypeScript

- **Strict mode enabled**: All packages use `strict: true`
- **Target**: ES2020
- **Module**: ESNext
- **Module Resolution**: Bundler

### Prettier

Formatting enforced via Prettier:

```bash
# Format all code
pnpm format

# Check formatting
pnpm format:check
```

**Config**: Uses default Prettier settings.

### ESLint

Linting rules configured per package:

```bash
# Lint all packages
pnpm lint

# Auto-fix
pnpm lint --fix
```

---

## CI/CD Workflows

### CI Workflow (`.github/workflows/ci.yml`)

Runs on **every PR and push to main**:

1. **Lint**: ESLint on all packages
2. **Type Check**: TypeScript compilation
3. **Test**: Vitest on Node 18, 20, 22 (matrix)
4. **Build**: tsup build verification

### Release Workflow (`.github/workflows/release.yml`)

Runs on **push to main**:

1. **Check for changesets**
2. **If changesets exist**:
   - Create "Version Packages" PR
3. **When "Version Packages" PR merged**:
   - Build packages
   - Publish to npm (with provenance)
   - Create git tags
   - Create GitHub releases

### Integration Tests (`.github/workflows/integration.yml`)

Runs on **PRs and daily**:

- Tests SDK against local Brokle server
- Currently placeholder (to be implemented)

---

## Environment & Configuration

### Node.js Versions

- **Required**: >=18.0.0
- **Tested**: 18, 20, 22
- **Recommended**: 20 LTS

### pnpm Version

- **Required**: >=8.0.0
- **Package Manager**: pnpm@8.15.0 (specified in `package.json`)

### Environment Variables

**For Development**:
```bash
# Brokle API configuration
BROKLE_API_KEY=your_api_key
BROKLE_BASE_URL=http://localhost:8080

# For testing
NODE_ENV=test
```

**For Publishing** (GitHub Secrets):
```bash
NPM_TOKEN=<your_npm_token>
GITHUB_TOKEN=<auto_provided>
```

---

## Publishing to npm

### First-Time Setup

1. **Create npm account** (if needed): https://www.npmjs.com/signup

2. **Add to npm org** (if using @brokle scope):
   ```bash
   npm owner add <username> brokle
   npm owner add <username> brokle-openai
   npm owner add <username> brokle-anthropic
   npm owner add <username> brokle-langchain
   ```

3. **Generate npm token**:
   - Go to: https://www.npmjs.com/settings/<username>/tokens
   - Create "Automation" token
   - Add to GitHub Secrets as `NPM_TOKEN`

4. **Add npm provenance** (security):
   Already configured in `release.yml` with `id-token: write`

### Publishing Process

Changesets handles everything automatically:

1. Make changes → Create changeset → Merge to main
2. Changesets creates "Version Packages" PR
3. Review PR → Merge
4. Workflow publishes to npm automatically

**Manual publish** (for testing):
```bash
# Build all packages
pnpm build

# Publish (requires NPM_TOKEN env var)
pnpm release
```

---

## Troubleshooting

### Build Failures

**Problem**: `pnpm build` fails
**Solution**:
```bash
# Clean and rebuild
pnpm clean
pnpm install
pnpm build
```

### Type Errors

**Problem**: TypeScript errors in VSCode
**Solution**:
```bash
# Rebuild TypeScript declarations
pnpm build
# Restart TypeScript server in VSCode (Cmd+Shift+P → "Restart TS Server")
```

### Test Failures

**Problem**: Tests fail locally but pass in CI
**Solution**:
```bash
# Ensure Node version matches CI
node --version  # Should be 18, 20, or 22

# Use frozen lockfile
rm -rf node_modules pnpm-lock.yaml
pnpm install --frozen-lockfile
pnpm test
```

### Changeset Issues

**Problem**: Changeset not detected
**Solution**:
```bash
# Ensure changeset file committed
git status
git add .changeset/*.md
git commit -m "chore: add changeset"
```

---

## Architecture Decisions

### Why Changesets?

- **Industry Standard**: Used by React, Remix, Radix UI, etc.
- **Monorepo Native**: Designed for multi-package repos
- **Automated**: Reduces manual versioning errors
- **Changelogs**: Auto-generates from changeset summaries

### Why tsup?

- **Fast**: esbuild-based bundler
- **Zero Config**: Works out of the box
- **Dual Format**: ESM + CJS in one command
- **TypeScript**: Native .d.ts generation

### Why Vitest?

- **Fast**: Native ESM, parallel execution
- **Compatible**: Jest-compatible API
- **TypeScript**: First-class TypeScript support
- **Modern**: Better DX than Jest

---

## Links

- **Repository**: https://github.com/brokle-ai/brokle-js
- **npm**: https://www.npmjs.com/org/brokle (packages not yet published)
- **Changesets Docs**: https://github.com/changesets/changesets
- **tsup Docs**: https://tsup.egoist.dev/
- **Vitest Docs**: https://vitest.dev/
