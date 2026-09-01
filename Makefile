.PHONY: help install dev build codegen test check clean

help:
	@echo "Enterprise Agent-Native Monorepo Commands:"
	@echo "  make install   - Install all workspace dependencies"
	@echo "  make dev       - Run API (8080) and Web (3000) concurrently"
	@echo "  make codegen   - Export OpenAPI 3.1 & generate TypeScript types"
	@echo "  make test      - Run Rust integration tests and typecheck"
	@echo "  make check     - Fast syntax and type verification"
	@echo "  make build     - Build production Rust binary and React client"
	@echo "  make clean     - Remove build artifacts and temporary databases"

install:
	pnpm install

dev:
	./scripts/dev.sh

codegen:
	pnpm codegen

test:
	./scripts/test.sh

check:
	cargo check --manifest-path apps/api/Cargo.toml
	pnpm typecheck

build:
	pnpm build
	cargo build --manifest-path apps/api/Cargo.toml --release

clean:
	rm -rf target apps/web/dist packages/api-client/dist *.db *.db-wal *.db-shm
