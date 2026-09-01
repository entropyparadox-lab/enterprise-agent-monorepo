.PHONY: help install dev build codegen test test-unit test-visual check clean

help:
	@echo "Enterprise Agent-Native Monorepo Commands:"
	@echo "  make install       - Install all workspace dependencies"
	@echo "  make dev           - Run API (8080) and Web (3000) concurrently"
	@echo "  make codegen       - Export OpenAPI 3.1 & generate TypeScript types"
	@echo "  make test          - Run full 5-stage verification suite"
	@echo "  make test-unit     - Run 50ms Vitest frontend unit tests"
	@echo "  make test-visual   - Run Playwright frontend visual regression tests"
	@echo "  make check         - Fast syntax and type verification"
	@echo "  make build         - Build production Rust binary and React client"
	@echo "  make clean         - Remove build artifacts and temporary databases"

install:
	pnpm install

dev:
	./scripts/dev.sh

codegen:
	pnpm codegen

test:
	./scripts/test.sh

test-unit:
	pnpm test:unit

test-visual:
	pnpm test:visual

test-visual-update:
	pnpm test:visual:update

check:
	cargo check --manifest-path apps/api/Cargo.toml
	pnpm typecheck

build:
	pnpm build
	cargo build --manifest-path apps/api/Cargo.toml --release

clean:
	rm -rf target apps/web/dist packages/api-client/dist *.db *.db-wal *.db-shm
