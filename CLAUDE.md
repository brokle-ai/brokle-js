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

## Release Process (release-it)

This monorepo uses **release-it** for version management and releases, following the Langfuse pattern.

### Prerequisites

Before running any release command:

```bash
# 1. Ensure you're on main branch with clean working directory
git status  # Should show: "nothing to commit, working tree clean"

# 2. Ensure you're authenticated with npm
npm login   # Use brokle-ai account (brokle.project@gmail.com)

# 3. Verify all tests pass
pnpm test

# 4. Verify builds work
pnpm build
```

### Creating a Release

**Standard releases** (patch/minor/major):

```bash
# Preview what will happen (dry run - ALWAYS DO THIS FIRST!)
make release-dry
# OR: pnpm release:dry

# Release patch version (0.1.0 → 0.1.1)
make release-patch

# Release minor version (0.1.0 → 0.2.0)
make release-minor

# Release major version (0.1.0 → 1.0.0)
make release-major
```

**Interactive mode** (choose version type during release):

```bash
pnpm release
# Follow interactive prompts:
# 1. Select version increment (patch/minor/major)
# 2. Confirm changelog
# 3. Confirm Git commit
# 4. Confirm Git tag
# 5. Confirm GitHub release
# 6. Confirm npm publish
```

### What Happens During Release

release-it automatically:

1. ✅ **Validates**: Clean git, on main branch, upstream configured
2. ✅ **Cleans & Installs**: `pnpm clean && pnpm install`
3. ✅ **Builds**: `pnpm build` (all packages)
4. ✅ **Bumps Versions**: Updates all 4 `package.json` files (0.1.0 → 0.2.0)
5. ✅ **Commits**: `chore: release v0.2.0`
6. ✅ **Tags**: Creates git tag `v0.2.0`
7. ✅ **Pushes**: Git commit + tag
8. ✅ **GitHub Release**: Auto-generates release notes from commits
9. ✅ **npm Publish**: Publishes all 4 packages to npm with `latest` tag

**One command does everything!**

### Pre-release Versions

For testing features before stable release:

```bash
# Alpha release (0.1.0 → 0.1.1-alpha.0)
make release-alpha
# OR: pnpm release:alpha

# Beta release (0.1.0 → 0.1.1-beta.0)
make release-beta

# Release candidate (0.1.0 → 0.1.1-rc.0)
make release-rc
```

Pre-releases are published with appropriate npm dist-tags and won't be installed by default.

### Release Workflow Example

```bash
# 1. Make your changes
git checkout -b feat/new-feature
# ... make code changes ...
git commit -m "feat: add new feature"
git push origin feat/new-feature

# 2. Create PR, get reviewed, merge to main

# 3. Pull latest main
git checkout main
git pull origin main

# 4. Preview release
make release-dry

# 5. Create release
make release-minor

# 6. Done! ✅
# - All packages published to npm
# - Git tag v0.2.0 created
# - GitHub release created
# - Commit pushed to main
```

**Total time**: ~2 minutes after merge to main

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
