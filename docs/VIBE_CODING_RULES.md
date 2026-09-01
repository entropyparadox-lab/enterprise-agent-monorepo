# Vibe-Coding Rules & Zero-Error Protocols

Always follow these rules when developing in this monorepo to maintain zero compilation errors and zero regression.

---

## 1. 2-Step Documentation Retrieval Protocol

Before writing or modifying code in React 19, Tailwind v4, Axum 0.8, or SQLx:

1. **Search**: Run `doc-engine search "<keywords>" --lib <lib>` to check current API idioms.
2. **Template**: Run `doc-engine get <doc_id>` (e.g. `curated:enterprise-react-stack`, `curated:axum-0.8`) to copy verified imports.

---

## 2. React 19 & Frontend Guardrails

1. **`ref` as a Prop**: React 19 no longer uses `React.forwardRef`. Use `React.ComponentProps<'button'>` directly.
2. **Tailwind v4 Setup**: Use `@theme` in CSS instead of `tailwind.config.js`. Use `tw-animate-css` instead of `tailwindcss-animate`.
3. **Recharts Package Override**: Ensure `react-is: "^19.0.0"` is present in `pnpm.overrides` or root `package.json`.
4. **Toast Feedback**: Always use `sonner` (`import { toast } from 'sonner'`).
5. **No Manual API Types**: Always import API DTOs from `@repo/api-client`.

---

## 3. Rust Axum 0.8 & Backend Guardrails

1. **State Extraction**: Pass state via `.with_state(state)` on the API router, and merge `SwaggerUi` on the root `Router<()>`.
2. **SQLx Queries**: Use standard SQL parameterization. Keep all queries ANSI-compliant for future PostgreSQL portability.
3. **OpenAPI Sync**: Whenever adding or modifying an endpoint or model in `apps/api`, run `pnpm codegen` immediately.
4. **AppError Mapping**: Never panic in handlers. Return `Result<Json<T>, AppError>` and map errors to standard HTTP status codes.
