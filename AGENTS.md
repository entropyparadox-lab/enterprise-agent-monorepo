# AGENT_GUIDE.md - Enterprise Agent-Native Monorepo Operating Guide

Instructions for AI coding agents (Hermes, Claude Code, Cursor, Codex, Windsurf, Copilot) working in this monorepo.

---

## 1. Ground Truth & SSOT Rules

* **Documentation First (`docs/`)**: The files in `docs/` (`ARCHITECTURE.md`, `DATABASE_SCHEMA.md`, `API_CONTRACT.md`, `VIBE_CODING_RULES.md`) are the Single Source of Truth. Never invent routes, tables, or types that contradict `docs/`.
* **Lockfile Grounding**:
  * Frontend dependencies are pinned in `package.json` / `pnpm-lock.yaml`.
  * Backend dependencies are pinned in `apps/api/Cargo.toml` / `Cargo.lock`.
* **Zero Guessing Protocol**: Query `doc-engine search "<keywords>" --lib <lib>` and inspect verified boilerplate before generating complex code.

---

## 2. Common Monorepo Commands

```bash
# Install all workspace dependencies
pnpm install

# Run full monorepo in development mode (API on :8080, Web on :3000)
pnpm dev

# Generate TypeScript types from Rust Axum Utoipa OpenAPI spec
pnpm codegen

# Typecheck all frontend & packages
pnpm typecheck

# Build frontend packages & apps for production
pnpm build

# Build Rust backend
cargo build --manifest-path apps/api/Cargo.toml --release
```

---

## 3. Strict Coding Conventions

### Frontend (`apps/web` & `packages/api-client`)
* **React 19 Rules**:
  * Do NOT use `React.forwardRef()`. Use `React.ComponentProps<'element'>` with `ref` as a normal prop.
  * Use `sonner` for toast notifications (`import { toast } from 'sonner'`).
  * Use `@theme` in `src/index.css` for Tailwind v4. Do NOT create `tailwind.config.js`.
* **Type Safety**:
  * Import API DTOs from `@repo/api-client`. Do NOT hand-write duplicate TypeScript interfaces for backend responses.
  * Use `react-hook-form` with `zodResolver(schema)` for all modal and form inputs.

### Backend (`apps/api`)
* **Rust Axum 0.8 Rules**:
  * Handlers must accept `State(state): State<Arc<AppState>>` and return `Result<Json<T>, AppError>`.
  * Route definitions must be annotated with `#[utoipa::path(...)]` and included in `ApiDoc` in `src/openapi.rs`.
  * After editing any handler or model, run `pnpm codegen` to keep frontend types in sync.
* **Database & SQLite WAL**:
  * Maintain standard ANSI SQL in all queries (`SELECT ... WHERE id = ?`) to preserve 100% compatibility for future PostgreSQL 16+ migrations.
  * Use parameterized queries only (SQL injection prevention).

---

## 4. Verification Protocol Before Completing Tasks

Every code change MUST pass:
1. `cargo check --manifest-path apps/api/Cargo.toml` (Backend compiles with 0 errors)
2. `pnpm codegen` (OpenAPI spec and TypeScript types are in sync)
3. `pnpm typecheck` (Frontend TypeScript compiles with 0 errors)
4. `pnpm build` (Vite production build passes cleanly)
