use crate::core::{
    auth::AdminUser,
    db::sha256_hex,
    error::AppError,
    handlers::{rand_number, AppState},
    models::{
        ApiKeyInfo, CreateApiKeyRequest, CreateApiKeyResponse, UpdateUserRoleRequest, User, UserDto,
    },
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use std::sync::Arc;

#[utoipa::path(
    get,
    path = "/api/admin/users",
    responses(
        (status = 200, description = "List all enterprise users", body = Vec<UserDto>),
        (status = 403, description = "Forbidden: Admin only")
    ),
    tag = "admin"
)]
pub async fn list_admin_users(
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<UserDto>>, AppError> {
    let users: Vec<User> = sqlx::query_as(
        "SELECT id, email, name, password_hash, role, auth_type, status, created_at, updated_at FROM users ORDER BY created_at ASC"
    )
    .fetch_all(&state.pool)
    .await?;

    let dtos: Vec<UserDto> = users.into_iter().map(|u| u.to_dto()).collect();
    Ok(Json(dtos))
}

#[utoipa::path(
    put,
    path = "/api/admin/users/{id}/role",
    request_body = UpdateUserRoleRequest,
    responses(
        (status = 200, description = "User role updated", body = UserDto),
        (status = 403, description = "Forbidden: Admin only"),
        (status = 404, description = "User not found")
    ),
    tag = "admin"
)]
pub async fn update_user_role(
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateUserRoleRequest>,
) -> Result<Json<UserDto>, AppError> {
    if !matches!(payload.role.as_str(), "Admin" | "Operator" | "Viewer") {
        return Err(AppError::BadRequest(
            "유효하지 않은 역할(Role)입니다".to_string(),
        ));
    }

    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let res = sqlx::query("UPDATE users SET role = ?, updated_at = ? WHERE id = ?")
        .bind(&payload.role)
        .bind(&now)
        .bind(&id)
        .execute(&state.pool)
        .await?;

    if res.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("User {} not found", id)));
    }

    let updated: User = sqlx::query_as(
        "SELECT id, email, name, password_hash, role, auth_type, status, created_at, updated_at FROM users WHERE id = ?"
    )
    .bind(&id)
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(updated.to_dto()))
}

#[utoipa::path(
    get,
    path = "/api/admin/api-keys",
    responses(
        (status = 200, description = "List all issued API keys", body = Vec<ApiKeyInfo>),
        (status = 403, description = "Forbidden: Admin only")
    ),
    tag = "admin"
)]
pub async fn list_api_keys(
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<ApiKeyInfo>>, AppError> {
    let keys: Vec<ApiKeyInfo> = sqlx::query_as(
        "SELECT id, name, key_prefix, role, created_at, is_active FROM api_keys ORDER BY created_at DESC"
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(keys))
}

#[utoipa::path(
    post,
    path = "/api/admin/api-keys",
    request_body = CreateApiKeyRequest,
    responses(
        (status = 201, description = "API Key issued successfully", body = CreateApiKeyResponse),
        (status = 403, description = "Forbidden: Admin only")
    ),
    tag = "admin"
)]
pub async fn create_api_key(
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateApiKeyRequest>,
) -> Result<(StatusCode, Json<CreateApiKeyResponse>), AppError> {
    if payload.name.trim().is_empty() {
        return Err(AppError::BadRequest(
            "API Key 이름을 입력해주세요".to_string(),
        ));
    }

    let role = payload.role.unwrap_or_else(|| "Operator".to_string());
    let id = format!("KEY-{:04}", rand_number());
    let random_secret = format!("{:x}{:x}", rand_number(), rand_number());
    let raw_key = format!("ep_live_{}", random_secret);
    let key_prefix = format!("ep_live_{}", &random_secret[..4.min(random_secret.len())]);
    let key_hash = sha256_hex(&raw_key);
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    sqlx::query(
        "INSERT INTO api_keys (id, name, key_prefix, key_hash, role, created_at, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)"
    )
    .bind(&id)
    .bind(&payload.name)
    .bind(&key_prefix)
    .bind(&key_hash)
    .bind(&role)
    .bind(&now)
    .execute(&state.pool)
    .await?;

    let key_info = ApiKeyInfo {
        id,
        name: payload.name,
        key_prefix,
        role,
        created_at: now,
        is_active: true,
    };

    Ok((
        StatusCode::CREATED,
        Json(CreateApiKeyResponse { raw_key, key_info }),
    ))
}

#[utoipa::path(
    delete,
    path = "/api/admin/api-keys/{id}",
    responses(
        (status = 204, description = "API Key revoked"),
        (status = 403, description = "Forbidden: Admin only"),
        (status = 404, description = "API Key not found")
    ),
    tag = "admin"
)]
pub async fn revoke_api_key(
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    let res = sqlx::query("UPDATE api_keys SET is_active = 0 WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await?;

    if res.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("API Key {} not found", id)));
    }

    Ok(StatusCode::NO_CONTENT)
}
