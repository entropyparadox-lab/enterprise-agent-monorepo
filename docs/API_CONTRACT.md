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

### A. Core: Authentication & Sessions
* **`POST /api/auth/register`**
  * Body: `RegisterRequest { email: string, name: string, password: string }`
  * Response `201`: `AuthResponse { token: string, user: UserDto }`
* **`POST /api/auth/login`**
  * Body: `LoginRequest { email: string, password: string }`
  * Response `200`: `AuthResponse { token: string, user: UserDto }` | `401`: `ErrorResponse`
* **`GET /api/auth/me`**
  * Headers: `Authorization: Bearer <token>`
  * Response `200`: `UserDto` | `401`: `ErrorResponse`

### B. Core: Enterprise Backoffice & RBAC (Admin Only)
* **`GET /api/admin/users`**
  * Response `200`: `Vec<UserDto>` | `403`: `ErrorResponse`
* **`PUT /api/admin/users/{id}/role`**
  * Body: `UpdateUserRoleRequest { role: "Admin" | "Operator" | "Viewer" }`
  * Response `200`: `UserDto` | `403`: `ErrorResponse`
* **`GET /api/admin/api-keys`**
  * Response `200`: `Vec<ApiKeyInfo>` | `403`: `ErrorResponse`
* **`POST /api/admin/api-keys`**
  * Body: `CreateApiKeyRequest { name: string, role?: string }`
  * Response `201`: `CreateApiKeyResponse { raw_key: string, key_info: ApiKeyInfo }` | `403`: `ErrorResponse`
* **`DELETE /api/admin/api-keys/{id}`**
  * Response `204`: No Content | `403`: `ErrorResponse`

### C. Core: System Health & Audit Telemetry
* **`GET /api/health`**
  * Response `200`: `HealthResponse { status: "HEALTHY", version: string, uptime_seconds: u64, database: string }`
* **`GET /api/audit-logs`**
  * Response `200`: `Vec<AuditLog>`

### D. Business Modules: Sample Record (Reference CRUD)
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

---

## 3. Standard Error Envelope

All API errors return a standard JSON envelope:

```json
{
  "error": "Access denied: Admin privileges required",
  "code": "FORBIDDEN"
}
```
