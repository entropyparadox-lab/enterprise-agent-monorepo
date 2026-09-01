# Enterprise Monorepo Architecture & Specification (SSOT)

This document is the Single Source of Truth (SSOT) defining the enterprise architecture, directory boundaries, hybrid authentication flows, and domain expansion recipes for **AI-Native Coding Agents and Human Engineers**.

---

## 1. System Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│ [Frontend] apps/web (React 19.x + Vite 8.x + Tailwind CSS v4)          │
│  • Feature Slice Architecture (features/<domain>/)                     │
│  • shadcn/ui + TanStack Table v8 + TanStack Query v5                   │
│  • React Hook Form + Zod + Sonner + useAuthStore (Zustand)             │
│  • 5 Domain Slices: Admin Control Plane, ERP Grid, SIEM, Landing, Service│
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

## 2. Agent-Native Symmetrical Vertical Slice Structure

Both Backend and Frontend follow **symmetrical, self-contained feature slicing** to prevent monolithic God files.

### A. Backend (`apps/api/src/`)
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

### B. Frontend (`apps/web/src/`)
```
apps/web/src/
├── core/ or lib/                        # 🛡️ [Client Infrastructure Core]
│   ├── api.ts                           # API client instance with Bearer interceptor
│   ├── authStore.ts                     # Zustand global user session store
│   ├── env.ts                           # Type-safe Zod runtime environment validation
│   ├── utils.ts                         # Tailwind clsx/twMerge helper
│   └── components/                      # StateBoundary (5-state UI guard), ErrorBoundary
│
├── features/                            # 🚀 [Frontend Feature Slices (1 Folder = 1 Domain)]
│   ├── admin/                           # AdminView.tsx (User Directory, API Keys, Modals)
│   ├── sample_record/                   # OrderGridView.tsx (Order table, Zod modal, edit dialog)
│   ├── saas/                            # SaasSiemView.tsx (SIEM audit logs)
│   ├── cinematic/                       # CinematicView.tsx
│   ├── service/                         # ServiceView.tsx
│   └── auth/                            # AuthModal.tsx (Login & SSO dialog)
│
├── App.tsx                              # Thin Shell orchestrating Navbar & Tab Routing (~100 lines)
└── main.tsx
```

---

## 3. Frontend State Management 3 SSOT Rules

To eliminate state duplication and race conditions, state is partitioned into 3 strict categories:

1. **Server State (API Data)** ➔ **TanStack Query (`useQuery`, `useMutation`) Only**
   * Never copy API query responses into local `useState` or `Zustand`. Let TanStack Query manage cache and revalidation.
2. **Client Global State (Auth / Session)** ➔ **Zustand (`useAuthStore`) Only**
   * Used strictly for cross-cutting client state: JWT token, active user profile, theme.
3. **Form & Modal State (Input Validation)** ➔ **React Hook Form + Zod Only**
   * Keep transient form errors and validation isolated inside the form component.

---

## 4. 💡 10-Second Recipe: How to Add a New Fullstack Domain

When creating a new business feature (e.g. `employee`):

### 1. Backend Slice
```bash
cp -r apps/api/src/modules/sample_record apps/api/src/modules/employee
# Edit models.rs, handlers.rs, and mount in lib.rs / openapi.rs
```

### 2. Frontend Slice
```bash
cp -r apps/web/src/features/sample_record apps/web/src/features/employee
# Edit EmployeeGridView.tsx and mount in App.tsx
```

### 3. Sync & Test
```bash
make codegen && make test
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
