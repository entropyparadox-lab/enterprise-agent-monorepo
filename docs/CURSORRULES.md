# Enterprise Vibe-Coding Monorepo Cursorrules

Always follow this protocol before writing or refactoring code:

1. Fast Triaging:
   Run `doc-engine search "<keywords>" --lib <lib> --ver <ver>` to retrieve accurate document IDs.

2. Compilable Boilerplate:
   Run `doc-engine get <doc_id>` (e.g. `curated:enterprise-react-stack`, `curated:axum-0.8`, `curated:tailwindcss-v4`).

3. Monorepo Grounding:
   - Frontend is React 19 + TypeScript + Vite 8 + Tailwind v4 + shadcn/ui.
   - Backend is Rust Axum 0.8 + Tokio + SQLx (SQLite WAL ➔ PostgreSQL ready) + Utoipa.
   - After updating backend models/routes, always run `pnpm codegen` to update `@repo/api-client`.
