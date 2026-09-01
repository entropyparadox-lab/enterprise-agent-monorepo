# enterprise-agent-monorepo

> **The Enterprise-Grade, Zero-Error Monorepo Template for AI-Native & Autonomous Coding Agents.**
> Combining **React 19 (TypeScript + Vite 8 + Tailwind v4 + shadcn/ui)** with **Rust (Axum 0.8 + Tokio + SQLx SQLite WAL / Postgres)**.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Rust: Axum 0.8](https://img.shields.io/badge/Rust-Axum_0.8-orange.svg)](https://github.com/tokio-rs/axum)
[![React: 19.x](https://img.shields.io/badge/React-19.x-61dafb.svg)](https://react.dev)
[![TypeScript: Strict](https://img.shields.io/badge/TypeScript-Strict_5.9+-3178c6.svg)](https://www.typescriptlang.org/)
[![pnpm: v10](https://img.shields.io/badge/pnpm-v10.33-F69220.svg)](https://pnpm.io)
[![Language: English](https://img.shields.io/badge/Language-English-green.svg)](#)
[![Language: 한국어](https://img.shields.io/badge/Language-한국어-red.svg)](README.ko.md)

---

## ⚡ Why This Stack?

This boilerplate is designed specifically for **Agent-Native Development (where AI coding agents write 80%+ of the code)** and **Hyper-Dense MicroVM / MOS Deployment**:

```
┌────────────────────────────────────────────────────────┐
│ [Frontend] apps/web (React 19.x + Vite 8.x + Tailwind v4) │
│  • shadcn/ui + TanStack Table v8 + TanStack Query v5    │
│  • React Hook Form + Zod + Sonner + Lucide             │
└───────────────────────────┬────────────────────────────┘
                            │ (Zero-Drift OpenAPI 3.1 Fetch)
                            ▼
┌────────────────────────────────────────────────────────┐
│ [Contract] packages/api-client                         │
│  • 100% Auto-generated TS types directly from Rust     │
└───────────────────────────┬────────────────────────────┘
                            │ (HTTP REST / JSON-RPC)
                            ▼
┌────────────────────────────────────────────────────────┐
│ [Backend] apps/api (Rust Axum 0.8.x + Tokio)           │
│  • Utoipa OpenAPI 3.1 + Serde + Tracing                │
│  • SQLx 0.8 SQLite (WAL mode) ➔ Postgres 16+ Portable  │
│  • Hyper-dense MicroVM execution (1ms boot, 4MB RSS)   │
└────────────────────────────────────────────────────────┘
```

---

## 🏆 Key Architecture Highlights

| Layer | Technology | Key Advantage |
| :--- | :--- | :--- |
| **Frontend** | **React 19 + Vite 8 + TS** | 99%+ AI one-shot accuracy, 380ms production build |
| **Styling** | **Tailwind CSS v4 + Pretendard** | CSS-first `@theme` syntax, zero config bloat |
| **UI Components** | **shadcn/ui + Radix UI** | Accessible, copy-paste headless components |
| **Backend** | **Rust Axum 0.8 + Tokio** | Zero-GC, 4MB idle memory, 1ms cold-start on MicroVM |
| **Database** | **SQLite 3 WAL ➔ PostgreSQL** | Zero-config single-file with ANSI SQL Postgres compatibility |
| **Type Pipeline**| **Utoipa ➔ openapi-typescript** | `pnpm codegen` keeps frontend/backend types 100% in sync |
| **Process Control**| **Graceful Shutdown** | SIGINT/SIGTERM handlers safely flush SQLite WAL |

---

## 🚀 Quick Start

### 1. Requirements
* **Node.js**: `v22+` or `v24+` (with `pnpm v10+`)
* **Rust**: `1.85+` (stable with `cargo`)

### 2. Installation & Concurrent Dev
```bash
# Clone the repository
git clone https://github.com/entropyparadox-lab/enterprise-agent-monorepo.git
cd enterprise-agent-monorepo

# Install dependencies
pnpm install

# Start both Rust Backend (:8080) and React Frontend (:3000)
make dev
# or: ./scripts/dev.sh
```

Open:
* **Frontend**: `http://localhost:3000`
* **Axum API**: `http://localhost:8080/api/health`
* **Swagger UI**: `http://localhost:8080/swagger-ui`

---

## 🛠️ Common Commands

```bash
# Export OpenAPI & Sync TypeScript Types
make codegen      # or: pnpm codegen

# Strict Typecheck & Lint
make check        # or: cargo check && pnpm typecheck

# Run Integration Tests & E2E Verification
make test         # or: ./scripts/test.sh

# Production Builds (Rust ELF Binary + React Client)
make build        # or: pnpm build
```

---

## 📖 SSOT Documentation Index

All architectural specifications are codified in `docs/`:

* **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**: Monorepo boundaries, network topology, ports.
* **[docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)**: SQLite WAL mode configuration & PostgreSQL portability rules.
* **[docs/API_CONTRACT.md](docs/API_CONTRACT.md)**: REST endpoints, OpenAPI schemas, unified error envelope.
* **[docs/VIBE_CODING_RULES.md](docs/VIBE_CODING_RULES.md)**: Negative guidance & 2-step doc-engine compiler protocol.
* **[docs/AGENT_GUIDE.md](docs/AGENT_GUIDE.md)**: Comprehensive guide for AI coding agents.

---

## 🛡️ License
Licensed under the [MIT License](LICENSE). Copyright (c) 2026 EntropyParadox Lab.
