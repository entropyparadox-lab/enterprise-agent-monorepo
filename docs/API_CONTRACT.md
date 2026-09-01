# API Contract & OpenAPI Specification (SSOT)

## 1. Zero-Drift Type Pipeline

All frontend types are generated **directly from Rust structs via Utoipa OpenAPI 3.1**. Manual typing on the frontend is strictly forbidden.

```bash
# Run codegen to sync Rust structs ➔ TypeScript types
pnpm codegen
```

This executes:
1. `cargo run --manifest-path apps/api/Cargo.toml -- --export-openapi > packages/api-client/src/openapi.json`
2. `openapi-typescript packages/api-client/src/openapi.json -o packages/api-client/src/schema.d.ts`

---

## 2. API Endpoints Matrix

### A. System & Health
* **`GET /api/health`**
  * Response `200`: `HealthResponse { status: "HEALTHY", version: string, uptime_seconds: u64, database: string }`

### B. Orders Management (ERP)
* **`GET /api/orders`**
  * Query parameters: `search` (string), `status` (string), `limit` (i64), `offset` (i64)
  * Response `200`: `Vec<Order>`
* **`GET /api/orders/{id}`**
  * Path parameter: `id` (string)
  * Response `200`: `Order` | `404`: `ErrorResponse`
* **`POST /api/orders`**
  * Body: `CreateOrderRequest { client: string, items: string, amount: i64, priority?: string }`
  * Response `201`: `Order` | `400`: `ErrorResponse`
* **`PUT /api/orders/{id}`**
  * Body: `UpdateOrderRequest { client?: string, items?: string, amount?: i64, status?: string, priority?: string }`
  * Response `200`: `Order` | `404`: `ErrorResponse`
* **`DELETE /api/orders/{id}`**
  * Response `204`: No Content | `404`: `ErrorResponse`

### C. Audit Logs (SIEM)
* **`GET /api/audit-logs`**
  * Response `200`: `Vec<AuditLog>`

---

## 3. Standard Error Envelope

All API errors return a standard JSON envelope:

```json
{
  "error": "Resource not found: ORD-2026-9999",
  "code": "NOT_FOUND"
}
```
