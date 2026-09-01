#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🦀 [1/4] Running Rust Integration Tests..."
cargo test --manifest-path apps/api/Cargo.toml

echo "✨ [2/5] Verifying OpenAPI Code Generation..."
pnpm codegen

echo "⚡ [3/5] Running Vitest Frontend Fast Unit Tests..."
pnpm test:unit

echo "🔍 [4/5] Running TypeScript Strict Typecheck..."
pnpm typecheck

echo "📸 [5/5] Running Playwright Frontend Visual Regression Tests..."
pnpm test:visual

echo "📦 [6/6] Running Production Build..."
pnpm build
cargo build --manifest-path apps/api/Cargo.toml --release

echo "✅ All verification suites passed with 0 errors!"
