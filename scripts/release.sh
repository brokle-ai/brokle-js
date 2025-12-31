#!/bin/bash
set -e

# Brokle JavaScript SDK Release Script
# Usage: ./scripts/release.sh [patch|minor|major]

BUMP_TYPE=${1:-patch}

echo "🚀 Brokle JavaScript SDK Release Script"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Validate bump type
if [[ ! "$BUMP_TYPE" =~ ^(patch|minor|major)$ ]]; then
    echo -e "${RED}❌ Invalid bump type: $BUMP_TYPE${NC}"
    echo "Usage: $0 [patch|minor|major]"
    exit 1
fi

# Check if we're on main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${RED}❌ Error: Not on main branch (currently on: $CURRENT_BRANCH)${NC}"
    echo "Please switch to main branch: git checkout main"
    exit 1
fi

# Check for clean working directory
if [[ -n $(git status --porcelain) ]]; then
    echo -e "${RED}❌ Error: Working directory is not clean${NC}"
    echo "Please commit or stash your changes first"
    git status --short
    exit 1
fi

# Check if branch is up to date
git fetch origin main
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u})

if [ $LOCAL != $REMOTE ]; then
    echo -e "${RED}❌ Error: Local branch is not up to date with origin/main${NC}"
    echo "Please pull latest changes: git pull origin main"
    exit 1
fi

# Get current version from workspace root package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")

echo "Current version: $CURRENT_VERSION"

# Check if current version is a pre-release
if [[ "$CURRENT_VERSION" =~ - ]]; then
  # Pre-release detected - promote to stable (don't increment)
  NEW_VERSION=${CURRENT_VERSION%%-*}
  echo -e "${YELLOW}⚠️  Pre-release detected!${NC}"
  echo "Promoting to stable: v$NEW_VERSION"
  echo ""
else
  # Stable version - increment normally
  IFS='.' read -r -a version_parts <<< "$CURRENT_VERSION"
  MAJOR="${version_parts[0]}"
  MINOR="${version_parts[1]}"
  PATCH="${version_parts[2]}"

  # Calculate new version
  case $BUMP_TYPE in
    major)
      MAJOR=$((MAJOR + 1))
      MINOR=0
      PATCH=0
      ;;
    minor)
      MINOR=$((MINOR + 1))
      PATCH=0
      ;;
    patch)
      PATCH=$((PATCH + 1))
      ;;
  esac

  NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
  echo "New version: v$NEW_VERSION"
  echo ""
fi

# Confirm with user
echo -e "${YELLOW}⚠️  This will update all package versions and create tag v$NEW_VERSION${NC}"
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ Release cancelled${NC}"
    exit 1
fi

# Run tests
echo ""
echo "📋 Running tests..."
if ! pnpm test; then
    echo -e "${RED}❌ Tests failed!${NC}"
    echo "Please fix failing tests before releasing"
    exit 1
fi
echo -e "${GREEN}✅ Tests passed${NC}"

# Update package.json version
echo ""
echo "📝 Updating package version to $NEW_VERSION..."

node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"
echo -e "${GREEN}✅ Updated package.json${NC}"

# Create git commit
echo ""
echo "📦 Creating release commit..."
git add package.json
git commit -m "chore: release v$NEW_VERSION"
echo -e "${GREEN}✅ Commit created${NC}"

# Create git tag
echo ""
echo "🏷️  Creating git tag v$NEW_VERSION..."
git tag "v$NEW_VERSION"
echo -e "${GREEN}✅ Tag created${NC}"

# Push to origin
echo ""
echo "⬆️  Pushing to GitHub..."
git push origin main
git push origin "v$NEW_VERSION"
echo -e "${GREEN}✅ Pushed to origin${NC}"

# Print next steps
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Version v$NEW_VERSION prepared and pushed!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 NEXT STEPS:"
echo ""
echo "1. Go to: https://github.com/brokle-ai/brokle-js/releases/new"
echo "2. Select tag: v$NEW_VERSION"
echo "3. Click 'Generate release notes'"
echo "4. Review and edit release notes"
echo "5. Mark as pre-release if needed (for alpha/beta/rc)"
echo "6. Click 'Publish release'"
echo ""
echo "🤖 After you publish the release:"
echo "   - GitHub Actions will build the package"
echo "   - GitHub Actions will publish to npm"
echo "   - Package will be published:"
echo "     • brokle@$NEW_VERSION"
echo ""
echo "   Sub-path exports available:"
echo "     • brokle/openai"
echo "     • brokle/anthropic"
echo "     • brokle/langchain"
echo "     • brokle/scorers"
echo ""
echo -e "${YELLOW}⏳ The release workflow will start automatically when you publish!${NC}"
echo ""
