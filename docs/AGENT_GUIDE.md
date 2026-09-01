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
# 1. Fast compiler check (1.3s - cargo check + tsc)
make check

# 2. Fast frontend unit test (80ms - Vitest)
make test-unit

# 3. Full 6-stage verification suite (15s)
make test

# 4. Playwright visual regression tests (2.0s)
make test-visual

# 5. Generate TypeScript types from Rust Axum Utoipa OpenAPI spec
make codegen

# 6. Deep code quality & cognitive complexity audit
make audit
```

---

## 3. Architecture & Coding Conventions

### Backend (`apps/api`) — Agent-Native Vertical Slice Pattern
* **Core vs Modules Separation**:
  * `apps/api/src/core/`: Immutable enterprise core (`auth.rs`, `db.rs`, `error.rs`, `models.rs`, `handlers/auth.rs`, `handlers/admin.rs`, `handlers/system.rs`). Do NOT put business feature logic into `core/`.
  * `apps/api/src/modules/`: Business domain slices (`sample_record/`, etc.). Each slice contains its own `models.rs`, `handlers.rs`, and `mod.rs`.
* **10-Second New Domain Expansion Recipe**:
  1. `cp -r apps/api/src/modules/sample_record apps/api/src/modules/<new_feature>`
  2. Edit schema in `models.rs` and SQLx queries in `handlers.rs`.
  3. Mount router in `apps/api/src/lib.rs` and register in `apps/api/src/openapi.rs`.
  4. Run `make codegen && make test`.
* **Rust Axum 0.8 Rules**:
  * Handlers must accept `State(state): State<Arc<AppState>>` and return `Result<Json<T>, AppError>`.
  * Route definitions must be annotated with `#[utoipa::path(...)]` and included in `ApiDoc` in `src/openapi.rs`.
  * Cognitive complexity per function must remain `<= 25` (`clippy.toml`).

### Frontend (`apps/web` & `packages/api-client`)
* **React 19 Rules**:
  * Do NOT use `React.forwardRef()`. Use `React.ComponentProps<'element'>` with `ref` as a normal prop.
  * Use `sonner` for toast notifications (`import { toast } from 'sonner'`).
  * Use `@theme` in `src/index.css` for Tailwind v4. Do NOT create `tailwind.config.js`.
* **7 Design Axioms (Anti-AI-Slop Protocol)**:
  * **1. Typography Hierarchy over Box Soup**: Do not nest borders and cards inside cards. Establish structure using font size, font weight, and ink contrast before adding containers.
  * **2. Color Discipline & Single Accent**: Keep surfaces dark neutral (`#090D16`, `#0B0F19`, `#1E293B`). Use only 1 brand accent (Cyan-500) and strict semantic states (Emerald, Rose, Amber).
  * **3. Layout Rhythm over 3-Card Grids**: Vary density, whitespace, asymmetric columns, and table/feed layouts based on data density.
  * **4. Zero Data Slop & Earned Content**: Display only data that aids decision-making. No decorative fake percentages or ungrounded chart widgets.
  * **5. Functional Iconography Only**: Do not prepend random Lucide icons to every button. Clear text labels and whitespace scanning come first.
  * **6. 5-State UI Completeness**: Every view MUST handle Loading (skeleton), Empty, Error, Success, and Stale states.
  * **7. Token Grounding**: Reference design tokens from `src/index.css` (`@theme`). Never hardcode arbitrary inline colors.
* **Type Safety**:
  * Import API DTOs from `@repo/api-client`. Do NOT hand-write duplicate TypeScript interfaces for backend responses.
  * Use `react-hook-form` with `zodResolver(schema)` for all modal and form inputs.

---

## 4. Pre-Commit Quality Gate

Before opening a PR, every agent MUST execute `./scripts/test.sh` (or `make test`) and verify all 6 checks succeed with 0 errors.
