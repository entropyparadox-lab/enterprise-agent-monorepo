use crate::error::AppError;
use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous},
    SqlitePool,
};
use std::str::FromStr;

pub async fn init_db_pool(db_url: &str) -> Result<SqlitePool, AppError> {
    let opts = SqliteConnectOptions::from_str(db_url)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Invalid DB URL: {}", e)))?
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
        .busy_timeout(std::time::Duration::from_secs(5));

    let pool = SqlitePoolOptions::new()
        .max_connections(20)
        .connect_with(opts)
        .await?;

    run_migrations(&pool).await?;

    Ok(pool)
}

async fn run_migrations(pool: &SqlitePool) -> Result<(), AppError> {
    // 1. Create orders table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            client TEXT NOT NULL,
            items TEXT NOT NULL,
            amount INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT '결제완료',
            priority TEXT NOT NULL DEFAULT '보통',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
        CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
        "#,
    )
    .execute(pool)
    .await?;

    // 2. Create audit logs table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            log_type TEXT NOT NULL,
            user_name TEXT NOT NULL,
            action TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'SUCCESS',
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
        "#,
    )
    .execute(pool)
    .await?;

    // 3. Seed initial data if empty
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM orders")
        .fetch_one(pool)
        .await?;

    if count.0 == 0 {
        sqlx::query(
            r#"
            INSERT INTO orders (id, client, items, amount, status, priority, created_at, updated_at) VALUES
            ('ORD-2026-0891', '엔트로피패러독스', 'AOT 가속 모듈 4EA', 4850000, '결제완료', '높음', '2026-09-01 10:00:00', '2026-09-01 10:00:00'),
            ('ORD-2026-0892', '메타오가닉 코리아', 'KTCC 5대 지표 분석 센서', 12500000, '배송준비', '높음', '2026-08-31 15:30:00', '2026-08-31 15:30:00'),
            ('ORD-2026-0893', '아진글로벌 시스템', 'Vision AI 엣지 게이트웨이', 8900000, '출고완료', '보통', '2026-08-30 09:15:00', '2026-08-30 09:15:00'),
            ('ORD-2026-0894', '보디나 연구소', 'WASM 샌드박스 라이선스 100유저', 3200000, '결제완료', '낮음', '2026-08-30 14:00:00', '2026-08-30 14:00:00'),
            ('ORD-2026-0895', '스마트제조 협회', 'MES 연동 미들웨어', 18000000, '배송준비', '보통', '2026-08-29 11:20:00', '2026-08-29 11:20:00'),
            ('ORD-2026-0896', '핀들 스튜디오', '영상 트랜스코더 R2 브릿지', 6400000, '주문취소', '낮음', '2026-08-28 17:45:00', '2026-08-28 17:45:00');
            "#,
        )
        .execute(pool)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO audit_logs (log_type, user_name, action, status, created_at) VALUES
            ('deploy', '성호 (DevOps)', 'Cluster #04 zgate hot-patch applied', 'SUCCESS', '2026-09-01 12:00:00'),
            ('security', 'Security Guard', 'Blocked unauthenticated RPC request from 203.0.113.42', 'BLOCKED', '2026-09-01 11:45:00'),
            ('deploy', '지수 (AI Lead)', 'Model pipeline weight re-anchored to Claude 3.7', 'SUCCESS', '2026-09-01 11:00:00'),
            ('security', 'IAM Policy', 'Ephemeral MicroVM sandbox #982 cleared', 'SUCCESS', '2026-09-01 09:30:00');
            "#,
        )
        .execute(pool)
        .await?;
    }

    Ok(())
}
