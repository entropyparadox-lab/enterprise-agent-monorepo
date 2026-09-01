#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🦀 [1/4] Running Rust Integration Tests..."
cargo test --manifest-path apps/api/Cargo.toml

echo "✨ [2/4] Verifying OpenAPI Code Generation..."
pnpm codegen

echo "🔍 [3/4] Running TypeScript Strict Typecheck..."
pnpm typecheck

echo "📦 [4/4] Running Production Production Build..."
pnpm build
cargo build --manifest-path apps/api/Cargo.toml --release

echo "✅ All verification suites passed with 0 errors!"
