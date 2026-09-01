# Database Schema & Migration Specification (SSOT)

## 1. Database Philosophy: SQLite WAL First ➔ PostgreSQL Ready

The default database is **SQLite 3 in WAL (Write-Ahead Logging) mode**, optimized for zero-configuration, single-file backups, and hyper-dense MicroVM execution.

### Concurrency & WAL Pragmas (Enforced in `apps/api/src/db/mod.rs`):
```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;
```

### PostgreSQL 16+ Migration Guarantees:
1. **Standard ANSI Types**: All columns use standard `TEXT`, `INTEGER` (64-bit), and `TIMESTAMPTZ` compatible ISO 8601 strings.
2. **SQLx Repository Pattern**: Queries use standard parameterized syntax (`SELECT ... WHERE id = ?` in SQLite, easily mapped to `$1` in Postgres).
3. **Primary Keys**: Prefixed string UUIDs (e.g. `ORD-2026-XXXX`) preventing sequence collision during replication.

---

## 2. Table DDL Specifications

### 1) `orders` Table (수주 및 배송 관리)
```sql
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,                       -- e.g. 'ORD-2026-0891'
    client TEXT NOT NULL,                      -- 고객사명
    items TEXT NOT NULL,                       -- 품목 요약
    amount INTEGER NOT NULL,                   -- 원화 금액 (KRW)
    status TEXT NOT NULL DEFAULT '결제완료',    -- '결제완료' | '배송준비' | '출고완료' | '주문취소'
    priority TEXT NOT NULL DEFAULT '보통',     -- '높음' | '보통' | '낮음'
    created_at TEXT NOT NULL,                  -- ISO 8601 'YYYY-MM-DD HH:MM:SS'
    updated_at TEXT NOT NULL                   -- ISO 8601 'YYYY-MM-DD HH:MM:SS'
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
```

### 2) `audit_logs` Table (시스템 보안 및 감사 로그)
```sql
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    log_type TEXT NOT NULL,                    -- 'deploy' | 'security' | 'order'
    user_name TEXT NOT NULL,                   -- 사번/이름
    action TEXT NOT NULL,                      -- 수행 내역
    status TEXT NOT NULL DEFAULT 'SUCCESS',    -- 'SUCCESS' | 'BLOCKED' | 'WARNING'
    created_at TEXT NOT NULL                   -- ISO 8601
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
```
