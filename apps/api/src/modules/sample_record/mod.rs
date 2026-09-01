pub mod handlers;
pub mod models;

use crate::core::{error::AppError, handlers::AppState};
use axum::{routing::get, Router};
use sqlx::SqlitePool;
use std::sync::Arc;

pub use models::{CreateOrderRequest, Order, UpdateOrderRequest};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/api/orders",
            get(handlers::list_orders).post(handlers::create_order),
        )
        .route(
            "/api/orders/{id}",
            get(handlers::get_order)
                .put(handlers::update_order)
                .delete(handlers::delete_order),
        )
}

pub async fn run_migrations(pool: &SqlitePool) -> Result<(), AppError> {
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

    let order_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM orders")
        .fetch_one(pool)
        .await?;

    if order_count.0 == 0 {
        sqlx::query(
            r#"
            INSERT INTO orders (id, client, items, amount, status, priority, created_at, updated_at) VALUES
            ('ORD-2026-0891', '엔트로피패러독스', 'AOT 가속 모듈 4EA', 4850000, '결제완료', '높음', '2026-09-01 10:00:00', '2026-09-01 10:00:00'),
            ('ORD-2026-0892', '메타오가닉 코리아', 'KTCC 5대 지표 분석 센서', 12500000, '배송준비', '높음', '2026-08-31 15:30:00', '2026-08-31 15:30:00'),
            ('ORD-2026-0893', '아진글로벌 시스템', 'Vision AI 엣지 게이트웨이', 8900000, '출고완료', '보통', '2026-08-30 09:15:00', '2026-08-30 09:15:00');
            "#,
        )
        .execute(pool)
        .await?;
    }

    Ok(())
}
