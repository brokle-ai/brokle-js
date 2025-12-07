.PHONY: help install build test lint typecheck clean release-patch release-minor release-major

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

# Releases (match Python SDK and Platform commands)
release-patch:
	./scripts/release.sh patch

release-minor:
	./scripts/release.sh minor

release-major:
	./scripts/release.sh major
