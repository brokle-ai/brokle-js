# Migration to Unified Release Strategy

**Date**: 2024-11-16
**Status**: Ready for Cleanup
**Repository**: `github.com/brokle-ai/brokle-js`

---

## What Changed

### Before (Multi-Package Releases)
```
Tags:     brokle@0.1.0, brokle-openai@0.1.0, brokle-anthropic@0.1.0, brokle-langchain@0.1.0
Releases: 4 separate GitHub releases
Style:    Per-package releases (Changesets default)
```

### After (Unified Releases)
```
Tags:     v0.1.0 (single tag for all packages)
Releases: 1 GitHub release listing all 4 packages
Style:    Unified monorepo release (Langfuse-style)
```

**npm packages unchanged** - Still 4 separate packages on npmjs.com

---

## Step-by-Step Cleanup Process

### Step 1: Delete Existing 0.1.0 Releases on GitHub

**Navigate to releases page**:
https://github.com/brokle-ai/brokle-js/releases

**Delete each release** (4 total):
1. Click on `brokle@0.1.0`
2. Click "Delete" button (bottom right)
3. Confirm deletion
4. Repeat for:
   - `brokle-openai@0.1.0`
   - `brokle-anthropic@0.1.0`
   - `brokle-langchain@0.1.0`

**Result**: All 4 releases deleted, but npm packages remain published ✅

---

### Step 2: Delete Existing 0.1.0 Tags

**Delete via GitHub UI**:
1. Go to: https://github.com/brokle-ai/brokle-js/tags
2. For each tag, click "..." → "Delete tag"
3. Delete all 4: `brokle@0.1.0`, `brokle-openai@0.1.0`, `brokle-anthropic@0.1.0`, `brokle-langchain@0.1.0`

**Or delete via command line**:
```bash
cd /Users/Hashir/Projects/Brokle-Project/brokle/sdk/javascript

# Delete tags locally
git tag -d brokle@0.1.0
git tag -d brokle-openai@0.1.0
git tag -d brokle-anthropic@0.1.0
git tag -d brokle-langchain@0.1.0

# Delete tags on GitHub
git push origin :refs/tags/brokle@0.1.0
git push origin :refs/tags/brokle-openai@0.1.0
git push origin :refs/tags/brokle-anthropic@0.1.0
git push origin :refs/tags/brokle-langchain@0.1.0

# Verify tags deleted
git ls-remote --tags origin
```

**Result**: Old tag strategy removed ✅

---

### Step 3: Create Unified v0.1.0 Release (Retroactive)

**Manual creation** (since 0.1.0 already published to npm):

**Go to**: https://github.com/brokle-ai/brokle-js/releases/new

**Fill in**:
- **Tag**: `v0.1.0` (create new tag)
- **Target**: main (select the commit where 0.1.0 was published: `44ffed8` or latest)
- **Release title**: `v0.1.0`
- **Description**:
```markdown
## Published Packages

- **brokle** ([npm](https://www.npmjs.com/package/brokle/v/0.1.0))
- **brokle-openai** ([npm](https://www.npmjs.com/package/brokle-openai/v/0.1.0))
- **brokle-anthropic** ([npm](https://www.npmjs.com/package/brokle-anthropic/v/0.1.0))
- **brokle-langchain** ([npm](https://www.npmjs.com/package/brokle-langchain/v/0.1.0))

## Changes

### Initial Release

This is the first public release of the Brokle JavaScript SDK monorepo.

#### Features

- **brokle**: OpenTelemetry-native observability SDK
  - GenAI 1.28+ semantic conventions support
  - Trace-level sampling with TraceIdRatioBasedSampler
  - Type-safe attribute constants
  - Gzip compression (65% size reduction)
  - Serverless + long-running app support

- **brokle-openai**: OpenAI SDK wrapper
  - Auto-instrumentation for OpenAI SDK v4+
  - Streaming support with real-time span updates

- **brokle-anthropic**: Anthropic SDK wrapper
  - Auto-instrumentation for Anthropic SDK v0.17+

- **brokle-langchain**: LangChain.js integration
  - Callbacks integration for automatic tracing

#### Infrastructure

- pnpm monorepo with workspace support
- TypeScript with full type definitions
- Dual format (ESM + CommonJS)
- Node.js 18+ support

---

For detailed changes, see [CHANGELOG.md](./CHANGELOG.md)
```

- **Check**: "Set as the latest release"
- Click **"Publish release"**

**Result**: Clean unified v0.1.0 release ✅

---

### Step 4: Commit Updated Workflow

```bash
cd /Users/Hashir/Projects/Brokle-Project/brokle/sdk/javascript

# Add all changes
git add .github/workflows/release.yml
git add CHANGELOG.md
git add UNIFIED_RELEASE_MIGRATION.md

# Commit
git commit -m "feat(release): switch to unified release strategy

- Update release workflow to create single tag per version (v0.2.0)
- Create single GitHub release listing all packages
- Add unified CHANGELOG.md (Langfuse-style)
- Add migration guide for cleanup process

Breaking change from previous approach:
- OLD: 4 tags/releases per version (brokle@X.Y.Z)
- NEW: 1 tag/release per version (vX.Y.Z)

Matches Langfuse, Next.js, and other unified monorepo patterns."

# Push
git push origin main
```

---

### Step 5: Test with v0.2.0 Release

**Create a test changeset**:
```bash
# Make a small change (e.g., add comment to README)
echo "\n<!-- Test unified release -->" >> packages/brokle/README.md

# Create changeset
pnpm changeset
# Select: All packages (or just brokle)
# Type: minor (0.1.0 → 0.2.0)
# Summary: "test: verify unified release workflow"

# Commit
git add .
git commit -m "test: prepare v0.2.0 unified release test"
git push origin main
```

**Wait for "Version Packages" PR**:
1. Changesets bot creates PR
2. PR bumps all packages to 0.2.0
3. PR updates CHANGELOGs

**Review and merge PR**:
1. Review changes in PR
2. Merge to main
3. Release workflow runs automatically

**Verify new release**:
1. Go to: https://github.com/brokle-ai/brokle-js/releases
2. Should see: **v0.2.0** (single release)
3. Lists all 4 packages
4. Single tag: `v0.2.0`

**Verify npm**:
```bash
npm info brokle@0.2.0
npm info brokle-openai@0.2.0
npm info brokle-anthropic@0.2.0
npm info brokle-langchain@0.2.0
```

All should show version 0.2.0 ✅

---

## Cleanup Checklist

Before testing v0.2.0:

- [ ] Delete 4 GitHub releases (brokle@0.1.0, etc.) via UI
- [ ] Delete 4 git tags (locally + remote)
- [ ] Create unified v0.1.0 release manually
- [ ] Commit workflow changes
- [ ] Push to main

After v0.2.0 test:

- [ ] Verify single tag created: `v0.2.0`
- [ ] Verify single GitHub release
- [ ] Verify all 4 packages published to npm
- [ ] Verify release body lists all packages
- [ ] Test installation from npm

---

## Git Commands Reference

### Delete Tags Locally
```bash
git tag -d brokle@0.1.0
git tag -d brokle-openai@0.1.0
git tag -d brokle-anthropic@0.1.0
git tag -d brokle-langchain@0.1.0
```

### Delete Tags on Remote
```bash
git push origin :refs/tags/brokle@0.1.0
git push origin :refs/tags/brokle-openai@0.1.0
git push origin :refs/tags/brokle-anthropic@0.1.0
git push origin :refs/tags/brokle-langchain@0.1.0
```

### Verify Tags Deleted
```bash
git ls-remote --tags origin
```

Should NOT show any `brokle@*` tags, only `v0.1.0` after you create it.

---

## Expected GitHub Releases View After Migration

**Before** (Current):
```
Latest   brokle-openai@0.1.0        (commit: 44ffed8)
         brokle@0.1.0                (commit: 44ffed8)
         brokle-anthropic@0.1.0      (commit: 44ffed8)
         brokle-langchain@0.1.0      (commit: 44ffed8)
```

**After** (Unified):
```
Latest   v0.2.0                      (commit: new)
         v0.1.0                      (commit: 44ffed8)
```

Clean, simple, unified! ✨

---

## Rollback Plan

If you want to revert to per-package releases:

1. Restore old release.yml from git history
2. Future releases will use per-package tags again
3. Old unified tags (v0.1.0, v0.2.0) remain in history

---

## FAQ

**Q: Will this break npm packages?**
A: No! npm packages are independent of git tags/releases. They'll work fine.

**Q: Will this delete npm packages?**
A: No! This only affects GitHub tags and releases, not npm registry.

**Q: Can users still install 0.1.0?**
A: Yes! `npm install brokle@0.1.0` still works (npm registry unchanged).

**Q: What if I skip the cleanup?**
A: Old tags/releases will coexist with new ones. Messy but functional.

**Q: Can I delete tags/releases later?**
A: Yes, cleanup can be done anytime. Doesn't affect npm.

---

## Next Release (v0.2.0) Workflow

After cleanup, future releases will follow this flow:

```bash
# 1. Make changes
# 2. Create changeset: pnpm changeset
# 3. Commit and push
# 4. Changesets creates "Version Packages" PR
# 5. Merge PR
# 6. Workflow creates:
#    - Single tag: v0.2.0
#    - Single GitHub release
#    - Publishes all 4 packages to npm
```

Clean and unified! 🎯

---

**Ready to start cleanup? Follow steps 1-3 above!**
