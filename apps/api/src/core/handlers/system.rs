use crate::core::{
    error::AppError,
    handlers::AppState,
    models::{AuditLog, HealthResponse},
};
use axum::{extract::State, Json};
use std::sync::atomic::Ordering;
use std::sync::Arc;

#[utoipa::path(
    get,
    path = "/api/health",
    responses(
        (status = 200, description = "System health status", body = HealthResponse)
    ),
    tag = "system"
)]
pub async fn get_health(
    State(state): State<Arc<AppState>>,
) -> Result<Json<HealthResponse>, AppError> {
    state.request_count.fetch_add(1, Ordering::Relaxed);
    let uptime = state.start_time.elapsed().as_secs();
    let db_ok = sqlx::query("SELECT 1").execute(&state.pool).await.is_ok();

    Ok(Json(HealthResponse {
        status: "HEALTHY".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        uptime_seconds: uptime,
        database: if db_ok {
            "CONNECTED_SQLITE_WAL".to_string()
        } else {
            "DISCONNECTED".to_string()
        },
    }))
}

#[utoipa::path(
    get,
    path = "/api/audit-logs",
    responses(
        (status = 200, description = "List of system audit logs", body = Vec<AuditLog>)
    ),
    tag = "system"
)]
pub async fn list_audit_logs(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<AuditLog>>, AppError> {
    let logs: Vec<AuditLog> = sqlx::query_as(
        r#"
        SELECT id, log_type, user_name, action, status, created_at
        FROM audit_logs
        ORDER BY id DESC
        LIMIT 50
        "#,
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(logs))
}
