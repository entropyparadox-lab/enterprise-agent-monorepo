# Monorepo Architecture & System Specification (SSOT)

## 1. System Overview

This monorepo is the enterprise standard boilerplate engineered specifically for **AI-Native Vibe-Coding** and deployment on **MOS (MicroVM / Firecracker)** infrastructure.

```
┌────────────────────────────────────────────────────────┐
│ [Frontend] apps/web (React 19.x + Vite 8.x + Tailwind v4) │
│  • shadcn/ui + TanStack Table v8 + TanStack Query v5    │
│  • React Hook Form + Zod + Sonner + Lucide             │
└───────────────────────────┬────────────────────────────┘
                            │ (Type-Safe OpenAPI Fetch)
                            ▼
┌────────────────────────────────────────────────────────┐
│ [Contract] packages/api-client                         │
│  • Auto-generated TypeScript definitions (utoipa JSON)  │
└───────────────────────────┬────────────────────────────┘
                            │ (HTTP JSON-RPC / REST)
                            ▼
┌────────────────────────────────────────────────────────┐
│ [Backend] apps/api (Rust Axum 0.8.x + Tokio)           │
│  • Utoipa OpenAPI 3.1 + Serde + Tracing                │
│  • SQLx 0.8 SQLite (WAL mode) ➔ Postgres 16+ Ready     │
│  • Hyper-dense MicroVM execution (1ms boot, 4MB RSS)   │
└────────────────────────────────────────────────────────┘
```

---

## 2. Directory Structure

```
enterprise-agent-monorepo/
├── AGENT_GUIDE.md             # Comprehensive instructions for AI coding agents
├── CURSORRULES.md             # Cursor AI compiler & doc retrieval protocol
├── Cargo.toml                 # Cargo workspace root
├── pnpm-workspace.yaml        # PNPM workspace root
├── package.json               # Root scripts (dev, build, codegen, typecheck)
├── docs/                      # Single Source of Truth (SSOT) specifications
│   ├── ARCHITECTURE.md        # System architecture & boundaries
│   ├── DATABASE_SCHEMA.md     # SQLite WAL & Postgres migration spec
│   ├── API_CONTRACT.md        # REST & OpenAPI specification
│   └── VIBE_CODING_RULES.md   # AI generation rules & guardrails
├── apps/
│   ├── api/                   # Rust Axum 0.8 Backend service
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── main.rs        # Axum router & CLI flags
│   │       ├── db/            # SQLite WAL connection pool & migrations
│   │       ├── models/        # Domain structs & DTOs
│   │       ├── handlers/      # REST API handlers
│   │       ├── error.rs       # AppError & IntoResponse
│   │       └── openapi.rs     # Utoipa OpenAPI 3.1 spec generator
│   └── web/                   # React 19 Frontend application
│       ├── package.json
│       ├── vite.config.ts     # Vite 8 with /api proxy
│       └── src/
│           ├── App.tsx        # Live CRUD & 4-Domain dashboard
│           ├── main.tsx
│           └── lib/           # utils.ts, api.ts
└── packages/
    └── api-client/            # Shared TypeScript API definitions
        ├── package.json
        └── src/
            ├── openapi.json   # Exported OpenAPI 3.1 schema
            ├── schema.d.ts    # Generated TypeScript types
            └── index.ts       # Typed client export
```

---

## 3. Network Ports & Proxy Configuration

| Service | Development Port | Production / MicroVM Port | Proxy Target |
| :--- | :--- | :--- | :--- |
| **Frontend (`apps/web`)** | `http://127.0.0.1:3000` | Port `80` / Static Bundle | Proxies `/api` to `:8080` |
| **Backend (`apps/api`)** | `http://127.0.0.1:8080` | Port `8080` (MicroVM) | Native Axum binary |
| **Swagger UI** | `http://127.0.0.1:8080/swagger-ui` | `/swagger-ui` | Utoipa Swagger |
