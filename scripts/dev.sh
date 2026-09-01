#!/usr/bin/env bash
set -e

# Enterprise Agent-Native Monorepo Concurrent Dev Server
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🦀 Starting Rust Axum 0.8 Backend (Port 8080)..."
cargo run --manifest-path apps/api/Cargo.toml &
API_PID=$!

cleanup() {
  echo ""
  echo "🛑 Shutting down development servers..."
  kill $API_PID 2>/dev/null || true
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

echo "⚡ Starting React 19 Vite Dev Server (Port 3000)..."
pnpm --filter "web" dev
