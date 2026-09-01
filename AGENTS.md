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

# Run Playwright visual regression tests
make test-visual

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
  * Wrap async data views with `StateBoundary` (`src/components/StateBoundary.tsx`) to guarantee 5-state UI completeness.
* **7 Design Axioms & 3-Tier Token System (Stripe/Linear Standard)**:
  * **1. 3-Tier Semantic Token Grounding**: NEVER use raw color classes (e.g. `bg-cyan-600`, `text-slate-900`) in components. Always use semantic tokens defined in `src/index.css` (`@theme`):
    * Surfaces: `bg-surface-canvas`, `bg-surface-panel`, `bg-surface-subtle`, `border-surface-border`
    * Ink/Typography: `text-ink-title`, `text-ink-body`, `text-ink-muted`, `text-ink-disabled`
    * Brand & Status: `bg-brand-primary`, `text-brand-primary`, `bg-status-success-bg`, `text-status-success`, `bg-status-danger-bg`, `text-status-danger`
    * Radius: `rounded-card` (12px), `rounded-button` (8px), `rounded-badge` (6px)
  * **2. 80-15-5 Color Allocation**: 80% clean surfaces (`#F8FAFC`, `#FFFFFF`), 15% high-contrast deep ink (`#0F172A`), 5% high-signal brand/status accents. No rainbow palettes or muddy dark gradients.
  * **3. Typography Hierarchy over Box Soup**: Do not nest borders and cards inside cards. Establish structure using font size, font weight, and ink contrast before adding containers.
  * **4. Layout Rhythm & Density**: Avoid defaulting to 3-column box cards. Use high-density data strips, structured tables, and clean whitespace.
  * **5. Zero Data Slop & Earned Content**: Display only data that aids decision-making. No decorative fake percentages ("+12.4% vs last week"), ungrounded chart widgets, or placeholder KPI badges.
  * **6. Functional Iconography Only**: Do not prepend random Lucide icons to every button and list item. Clear text labels and whitespace scanning come first.
  * **7. 5-State UI Completeness**: Every view MUST handle Loading (skeleton), Empty (actionable callout), Error (recovery retry), Success, and Partial/Stale states via `StateBoundary`.
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
