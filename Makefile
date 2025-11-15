.PHONY: help install build test lint typecheck clean release-patch release-minor release-major release-dry release-alpha release-beta release-rc

help:
	@echo "Brokle JavaScript SDK - Available Commands"
	@echo ""
	@echo "Development:"
	@echo "  make install           Install dependencies"
	@echo "  make build             Build all packages"
	@echo "  make test              Run all tests"
	@echo "  make lint              Lint all packages"
	@echo "  make typecheck         Type check all packages"
	@echo "  make clean             Clean build artifacts"
	@echo ""
	@echo "Release:"
	@echo "  make release-patch     Release patch version (0.1.0 → 0.1.1)"
	@echo "  make release-minor     Release minor version (0.1.0 → 0.2.0)"
	@echo "  make release-major     Release major version (0.1.0 → 1.0.0)"
	@echo "  make release-dry       Dry run release (preview only)"
	@echo ""
	@echo "Pre-releases:"
	@echo "  make release-alpha     Release alpha version (0.1.0 → 0.1.1-alpha.0)"
	@echo "  make release-beta      Release beta version (0.1.0 → 0.1.1-beta.0)"
	@echo "  make release-rc        Release RC version (0.1.0 → 0.1.1-rc.0)"
	@echo ""
	@echo "Release Flow (matches Python SDK):"
	@echo "  1. make release-patch"
	@echo "  2. Follow interactive prompts"
	@echo "  3. Automatically: bumps version, commits, tags, pushes, publishes to npm"
	@echo ""

# Development
install:
	pnpm install

build:
	pnpm build

test:
	pnpm test

lint:
	pnpm lint

typecheck:
	pnpm typecheck

clean:
	pnpm clean

# Releases (match Python SDK commands)
release-patch:
	pnpm release patch

release-minor:
	pnpm release minor

release-major:
	pnpm release major

release-dry:
	pnpm release:dry

# Pre-releases
release-alpha:
	pnpm release:alpha

release-beta:
	pnpm release:beta

release-rc:
	pnpm release:rc
