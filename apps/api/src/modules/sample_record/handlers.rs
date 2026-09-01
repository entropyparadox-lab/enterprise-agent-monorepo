use super::models::{CreateOrderRequest, Order, UpdateOrderRequest};
use crate::core::{error::AppError, handlers::AppState};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

#[derive(Deserialize)]
pub struct OrderQueryParams {
    pub search: Option<String>,
    pub status: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[utoipa::path(
    get,
    path = "/api/orders",
    params(
        ("search" = Option<String>, Query, description = "Keyword filter"),
        ("status" = Option<String>, Query, description = "Order status filter"),
        ("limit" = Option<i64>, Query, description = "Pagination limit"),
        ("offset" = Option<i64>, Query, description = "Pagination offset")
    ),
    responses(
        (status = 200, description = "List of filtered orders", body = Vec<Order>)
    ),
    tag = "orders"
)]
pub async fn list_orders(
    State(state): State<Arc<AppState>>,
    Query(params): Query<OrderQueryParams>,
) -> Result<Json<Vec<Order>>, AppError> {
    let limit = params.limit.unwrap_or(50).clamp(1, 100);
    let offset = params.offset.unwrap_or(0).max(0);

    let orders: Vec<Order> = match (&params.search, &params.status) {
        (Some(search), Some(status)) if status != "전체" => {
            let pattern = format!("%{}%", search);
            sqlx::query_as(
                r#"
                SELECT id, client, items, amount, status, priority, created_at, updated_at
                FROM orders
                WHERE (client LIKE ? OR id LIKE ?) AND status = ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
                "#,
            )
            .bind(&pattern)
            .bind(&pattern)
            .bind(status)
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.pool)
            .await?
        }
        (Some(search), _) => {
            let pattern = format!("%{}%", search);
            sqlx::query_as(
                r#"
                SELECT id, client, items, amount, status, priority, created_at, updated_at
                FROM orders
                WHERE client LIKE ? OR id LIKE ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
                "#,
            )
            .bind(&pattern)
            .bind(&pattern)
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.pool)
            .await?
        }
        (None, Some(status)) if status != "전체" => {
            sqlx::query_as(
                r#"
                SELECT id, client, items, amount, status, priority, created_at, updated_at
                FROM orders
                WHERE status = ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
                "#,
            )
            .bind(status)
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.pool)
            .await?
        }
        _ => {
            sqlx::query_as(
                r#"
                SELECT id, client, items, amount, status, priority, created_at, updated_at
                FROM orders
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
                "#,
            )
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.pool)
            .await?
        }
    };

    Ok(Json(orders))
}

#[utoipa::path(
    get,
    path = "/api/orders/{id}",
    params(
        ("id" = String, Path, description = "Order unique ID")
    ),
    responses(
        (status = 200, description = "Found order", body = Order),
        (status = 404, description = "Order not found")
    ),
    tag = "orders"
)]
pub async fn get_order(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Order>, AppError> {
    let order: Option<Order> = sqlx::query_as(
        r#"
        SELECT id, client, items, amount, status, priority, created_at, updated_at
        FROM orders
        WHERE id = ?
        "#,
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await?;

    match order {
        Some(o) => Ok(Json(o)),
        None => Err(AppError::NotFound(format!("Order {} not found", id))),
    }
}

#[utoipa::path(
    post,
    path = "/api/orders",
    request_body = CreateOrderRequest,
    responses(
        (status = 201, description = "Created order", body = Order)
    ),
    tag = "orders"
)]
pub async fn create_order(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateOrderRequest>,
) -> Result<(StatusCode, Json<Order>), AppError> {
    if payload.client.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Client name cannot be empty".to_string(),
        ));
    }
    if payload.amount <= 0 {
        return Err(AppError::BadRequest(
            "Amount must be greater than 0".to_string(),
        ));
    }

    let id = format!("ORD-2026-{:04}", rand_number());
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let priority = payload.priority.unwrap_or_else(|| "보통".to_string());
    let status = "결제완료".to_string();

    sqlx::query(
        r#"
        INSERT INTO orders (id, client, items, amount, status, priority, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&payload.client)
    .bind(&payload.items)
    .bind(payload.amount)
    .bind(&status)
    .bind(&priority)
    .bind(&now)
    .bind(&now)
    .execute(&state.pool)
    .await?;

    let order = Order {
        id,
        client: payload.client,
        items: payload.items,
        amount: payload.amount,
        status,
        priority,
        created_at: now.clone(),
        updated_at: now,
    };

    Ok((StatusCode::CREATED, Json(order)))
}

#[utoipa::path(
    put,
    path = "/api/orders/{id}",
    request_body = UpdateOrderRequest,
    responses(
        (status = 200, description = "Updated order", body = Order),
        (status = 404, description = "Order not found")
    ),
    tag = "orders"
)]
pub async fn update_order(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateOrderRequest>,
) -> Result<Json<Order>, AppError> {
    let existing: Order = sqlx::query_as(
        r#"SELECT id, client, items, amount, status, priority, created_at, updated_at FROM orders WHERE id = ?"#,
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Order {} not found", id)))?;

    let client = payload.client.unwrap_or(existing.client);
    let items = payload.items.unwrap_or(existing.items);
    let amount = payload.amount.unwrap_or(existing.amount);
    let status = payload.status.unwrap_or(existing.status);
    let priority = payload.priority.unwrap_or(existing.priority);
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    sqlx::query(
        r#"
        UPDATE orders
        SET client = ?, items = ?, amount = ?, status = ?, priority = ?, updated_at = ?
        WHERE id = ?
        "#,
    )
    .bind(&client)
    .bind(&items)
    .bind(amount)
    .bind(&status)
    .bind(&priority)
    .bind(&now)
    .bind(&id)
    .execute(&state.pool)
    .await?;

    let updated = Order {
        id,
        client,
        items,
        amount,
        status,
        priority,
        created_at: existing.created_at,
        updated_at: now,
    };

    Ok(Json(updated))
}

#[utoipa::path(
    delete,
    path = "/api/orders/{id}",
    responses(
        (status = 204, description = "Order deleted successfully"),
        (status = 404, description = "Order not found")
    ),
    tag = "orders"
)]
pub async fn delete_order(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    let res = sqlx::query("DELETE FROM orders WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await?;

    if res.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Order {} not found", id)));
    }

    Ok(StatusCode::NO_CONTENT)
}

fn rand_number() -> u32 {
    use std::time::SystemTime;
    let nanos = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    (nanos % 9000) + 1000
}
