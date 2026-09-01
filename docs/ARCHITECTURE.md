# Enterprise Monorepo Architecture & Specification (SSOT)

This document is the Single Source of Truth (SSOT) defining the enterprise architecture, directory boundaries, hybrid authentication flows, and domain expansion recipes for **AI-Native Coding Agents and Human Engineers**.

---

## 1. System Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│ [Frontend] apps/web (React 19.x + Vite 8.x + Tailwind CSS v4)          │
│  • shadcn/ui + TanStack Table v8 + TanStack Query v5                   │
│  • React Hook Form + Zod + Sonner + useAuthStore (Zustand)             │
│  • 5 Domain Views: Backoffice Control Plane, ERP Grid, SIEM, Landing   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ (OpenAPI 3.1 Type-Safe Fetch)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ [Contract] packages/api-client                                         │
│  • Zero-drift TypeScript client auto-generated from Utoipa OpenAPI     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ (REST / JSON-RPC via Bearer JWT & M2M Key)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ [Backend] apps/api (Rust Axum 0.8.x + Tokio 1.43)                      │
│  • Vertical Slice Architecture (Immutable Core vs Business Modules)    │
│  • Argon2id + jsonwebtoken + Scoped SHA-256 M2M API Keys               │
│  • SQLx 0.8 SQLite WAL (<2ms cold start, 4MB idle RSS) ➔ Postgres Ready│
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Agent-Native Vertical Slice Directory Structure

```
apps/api/src/
├── core/                                # 🛡️ [Immutable Enterprise Core]
│   ├── auth.rs                          # Argon2id, JWT issuance, AuthUser & AdminUser extractors
│   ├── db.rs                            # SQLite WAL pool & Core migrations (users, api_keys, logs)
│   ├── error.rs                         # AppError (401/403/404/500) & ErrorResponse JSON
│   ├── models.rs                        # User, UserDto, ApiKeyInfo, HealthResponse, AuditLog
│   └── handlers/
│       ├── auth.rs                      # /api/auth/register, /api/auth/login, /api/auth/me
│       ├── admin.rs                     # /api/admin/users, /api/admin/api-keys
│       └── system.rs                    # /api/health, /api/audit-logs
│
├── modules/                             # 🚀 [Business Domain Slices]
│   └── sample_record/                   # 💡 Copy-and-replace golden reference template
│       ├── models.rs                    # Order entity & DTOs (ToSchema, FromRow)
│       ├── handlers.rs                  # All-in-one SQLx queries & Axum handlers
│       └── mod.rs                       # Sub-router & orders table migrations
│
├── openapi.rs                           # Aggregated Utoipa OpenAPI 3.1 schema registry
├── lib.rs                               # App router assembly & CORS/Trace middleware
└── main.rs                              # CLI binary, SQLite connection & Graceful Shutdown
```

---

## 3. Hybrid Authentication & RBAC Flow

```
                                [Client Request]
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
     [Human: Browser SSO / PW]                     [Machine: AI Agent / CI]
     • Header: `Bearer <jwt_token>`                • Header: `Bearer ep_live_...`
     • Validated via jsonwebtoken (HS256)          • Validated via SHA-256 Hash in `api_keys`
                │                                             │
                └──────────────────────┬──────────────────────┘
                                       ▼
                   [Axum Extractor: `AuthUser`]
                   • Extracts: id, email, name, role (Admin | Operator | Viewer)
                                       │
                                       ▼ (For Admin-only endpoints)
                   [Axum Extractor: `AdminUser`]
                   • Enforces `user.role == Admin` ➔ Returns 403 FORBIDDEN if violated
```

---

## 4. 💡 10-Second Recipe: How to Add a New Business Feature

When adding a new domain entity (e.g., `employee` for HR management):

### Step 1: Clone the reference vertical slice
```bash
cp -r apps/api/src/modules/sample_record apps/api/src/modules/employee
```

### Step 2: Define Schema in `apps/api/src/modules/employee/models.rs`
```rust
#[derive(Debug, Serialize, Deserialize, FromRow, ToSchema, Clone)]
pub struct Employee {
    pub id: String,
    pub name: String,
    pub department: String,
    pub position: String,
    pub salary: i64,
    pub created_at: String,
}
```

### Step 3: Implement Handlers in `apps/api/src/modules/employee/handlers.rs`
Implement CRUD queries using SQLx and annotate with `#[utoipa::path(...)]`.

### Step 4: Mount Router & Export in `apps/api/src/modules/mod.rs` & `apps/api/src/lib.rs`
```rust
// In apps/api/src/modules/mod.rs
pub mod employee;
pub mod sample_record;

// In apps/api/src/lib.rs
let employee_router = modules::employee::router().with_state(state.clone());
```

### Step 5: Sync Types & Verify
```bash
make codegen   # Regenerates packages/api-client/src/schema.d.ts in 30ms
make test      # Runs in-memory DB tests + TS typecheck + Visual snapshots
```

---

## 5. Verification & Testing Standards

All code contributions must pass the **6-Stage Quality Gate**:

```bash
make check        # 1.3s: Fast cargo check + TS typecheck
make test         # 15s: Rust tests + Proptest + Vitest + Playwright Visual Snapshots
make test-unit    # 80ms: Frontend sub-second unit tests (Vitest)
make test-visual  # 2.0s: Playwright pixel-level screenshot regression tests
make audit        # Deep clippy cognitive complexity (<= 25) & mutation checks
```
