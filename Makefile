.PHONY: all build test typecheck lint lint-fix format clean \
       docs docs-dev audit doctor release version changeset ci watch arch help

all: lint typecheck build test ## Lint, typecheck, build, and test everything

# ── Build ────────────────────────────────────────────────────
build: ## Build all packages
	npm run build

# ── Test ─────────────────────────────────────────────────────
test: ## Run all tests
	npm test

test-core: ## Run core tests only
	npm test -w packages/core

test-vitest: ## Run vitest adapter tests only
	npm test -w packages/vitest

test-cli: ## Run CLI tests only
	npm test -w packages/cli

test-promptfoo: ## Run promptfoo tests only
	npm test -w packages/promptfoo

test-mcp: ## Run MCP server tests only
	npm test -w packages/mcp-server

test-live: ## Run tests in live mode (requires API keys)
	TRACEPACT_LIVE=1 npm test

test-full: ## Run tests including L3/L4 (requires API keys)
	TRACEPACT_LIVE=1 TRACEPACT_FULL=1 npm test

watch: ## Run core tests in watch mode
	npm run test:watch -w packages/core

# ── Quality ──────────────────────────────────────────────────
typecheck: ## Type-check all packages
	npm run typecheck

lint: ## Lint with Biome
	npm run lint

lint-fix: ## Lint and auto-fix with Biome
	npm run lint:fix

format: lint-fix ## Alias for lint-fix

# ── TracePact CLI ────────────────────────────────────────────
audit: ## Static analysis on SKILL.md files (no API key)
	npx tracepact audit

doctor: ## Environment health check
	npx tracepact doctor

cost-report: ## Token cost breakdown from last live run
	npx tracepact cost-report

# ── Architecture ─────────────────────────────────────────────
arch: ## Regenerate architecture/generated blocks from code
	npm run generate:arch

# ── Docs ─────────────────────────────────────────────────────
docs: ## Build VitePress docs
	npx vitepress build docs

docs-dev: ## Start VitePress dev server
	npx vitepress dev docs

# ── Release ──────────────────────────────────────────────────
changeset: ## Add a changeset for the current changes
	npx changeset

version: ## Apply changesets → bump versions + changelogs
	npm run version

release: build ## Build and publish via changesets
	npm run release

# ── Housekeeping ─────────────────────────────────────────────
clean: ## Remove all dist/ directories
	npm run clean

node_modules: package.json packages/*/package.json ## Install deps if needed
	npm install
	@touch node_modules

# ── CI (mirrors GitHub Actions) ──────────────────────────────
ci: lint typecheck build test ## Full CI pipeline: lint → typecheck → build → test

# ── Help ─────────────────────────────────────────────────────
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'
