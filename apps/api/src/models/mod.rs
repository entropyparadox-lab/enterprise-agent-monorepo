use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
    pub uptime_seconds: u64,
    pub database: String,
}

#[derive(Debug, Serialize, Deserialize, FromRow, ToSchema, Clone)]
pub struct Order {
    pub id: String,
    pub client: String,
    pub items: String,
    pub amount: i64,
    pub status: String,   // '결제완료' | '배송준비' | '출고완료' | '주문취소'
    pub priority: String, // '높음' | '보통' | '낮음'
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateOrderRequest {
    pub client: String,
    pub items: String,
    pub amount: i64,
    pub priority: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpdateOrderRequest {
    pub client: Option<String>,
    pub items: Option<String>,
    pub amount: Option<i64>,
    pub status: Option<String>,
    pub priority: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, ToSchema, Clone)]
pub struct AuditLog {
    pub id: i64,
    pub log_type: String, // 'deploy' | 'security' | 'order'
    pub user_name: String,
    pub action: String,
    pub status: String, // 'SUCCESS' | 'BLOCKED' | 'WARNING'
    pub created_at: String,
}
