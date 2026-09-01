# Database Schema & Migration Specification (SSOT)

## 1. Overview & Strategy

The database uses **SQLite 3 in WAL mode** for local development and ultra-low memory MOS MicroVM execution, designed with standard ANSI SQL data types to ensure zero-downtime, seamless migration to **PostgreSQL 16+**.

```
[Default Local / MicroVM]                 [Production Cloud Scale]
SQLite 3 (WAL mode)                       PostgreSQL 16+
• Zero config, single file                • Multi-region replicas, Row-level security
• Sub-millisecond queries                 • Connection pooling via PgBouncer
```

---

## 2. Table Specifications

### A. Core Tables

#### `users` (Enterprise User Directory & Hybrid Auth)
```sql
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,                       -- e.g. 'USR-0001'
    email TEXT UNIQUE NOT NULL,                -- Work email
    name TEXT NOT NULL,                        -- Display name
    password_hash TEXT,                        -- Argon2id password hash (null for SSO)
    role TEXT NOT NULL DEFAULT 'Viewer',       -- 'Admin' | 'Operator' | 'Viewer'
    auth_type TEXT NOT NULL DEFAULT 'Password',-- 'Password' | 'SsoGoogle' | 'ZeroTrust'
    status TEXT NOT NULL DEFAULT 'Active',     -- 'Active' | 'Suspended'
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
```

#### `api_keys` (M2M Scoped API Keys for AI Agents & CI)
```sql
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,                       -- e.g. 'KEY-0001'
    name TEXT NOT NULL,                        -- e.g. 'Hermes CI Worker Bot'
    key_prefix TEXT NOT NULL,                  -- e.g. 'ep_live_a1b2'
    key_hash TEXT NOT NULL UNIQUE,             -- SHA-256 hash of raw token
    role TEXT NOT NULL DEFAULT 'Operator',     -- 'Admin' | 'Operator' | 'Viewer'
    created_at TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1       -- 1 = Active, 0 = Revoked
);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
```

#### `audit_logs` (SIEM Security Audit Logs)
```sql
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    log_type TEXT NOT NULL,                    -- 'auth' | 'deploy' | 'security'
    user_name TEXT NOT NULL,
    action TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'SUCCESS',    -- 'SUCCESS' | 'BLOCKED' | 'FAILED'
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
```

### B. Business Domain Tables (Sample Module)

#### `orders` (Sample ERP Order Entities)
```sql
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,                       -- e.g. 'ORD-2026-0891'
    client TEXT NOT NULL,
    items TEXT NOT NULL,
    amount INTEGER NOT NULL,                   -- Price in KRW (integer)
    status TEXT NOT NULL DEFAULT '결제완료',
    priority TEXT NOT NULL DEFAULT '보통',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
```
