use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, FromRow, ToSchema, Clone)]
pub struct Order {
    pub id: String,
    pub client: String,
    pub items: String,
    pub amount: i64,
    pub status: String,
    pub priority: String,
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
