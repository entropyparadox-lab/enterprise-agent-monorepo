use crate::{
    auth::{create_jwt, AdminUser, AuthUser},
    db::sha256_hex,
    error::AppError,
    models::{
        ApiKeyInfo, AuditLog, AuthResponse, CreateApiKeyRequest, CreateApiKeyResponse,
        CreateOrderRequest, HealthResponse, LoginRequest, Order, RegisterRequest,
        UpdateOrderRequest, UpdateUserRoleRequest, User, UserDto,
    },
};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use sqlx::SqlitePool;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

pub struct AppState {
    pub pool: SqlitePool,
    pub start_time: std::time::Instant,
    pub request_count: AtomicU64,
}

#[derive(Deserialize)]
pub struct OrderQueryParams {
    pub search: Option<String>,
    pub status: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

// -----------------------------------------------------------------------------
// 1. Authentication Endpoints
// -----------------------------------------------------------------------------

#[utoipa::path(
    post,
    path = "/api/auth/register",
    request_body = RegisterRequest,
    responses(
        (status = 201, description = "User registered successfully", body = AuthResponse),
        (status = 400, description = "Bad request or email already exists")
    )
)]
pub async fn register(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<RegisterRequest>,
) -> Result<(StatusCode, Json<AuthResponse>), AppError> {
    if payload.email.trim().is_empty() || !payload.email.contains('@') {
        return Err(AppError::BadRequest(
            "유효한 이메일 주소를 입력해주세요".to_string(),
        ));
    }
    if payload.password.len() < 8 {
        return Err(AppError::BadRequest(
            "비밀번호는 최소 8자 이상이어야 합니다".to_string(),
        ));
    }

    // Check if email already exists
    let existing: Option<(String,)> = sqlx::query_as("SELECT id FROM users WHERE email = ?")
        .bind(&payload.email)
        .fetch_optional(&state.pool)
        .await?;

    if existing.is_some() {
        return Err(AppError::BadRequest(
            "이미 등록된 이메일 주소입니다".to_string(),
        ));
    }

    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let pw_hash = argon2
        .hash_password(payload.password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Hash error: {}", e)))?
        .to_string();

    let id = format!("USR-{:04}", rand_number());
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let role = "Viewer".to_string(); // Default self-registration role
    let auth_type = "Password".to_string();
    let status = "Active".to_string();

    sqlx::query(
        r#"
        INSERT INTO users (id, email, name, password_hash, role, auth_type, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&payload.email)
    .bind(&payload.name)
    .bind(&pw_hash)
    .bind(&role)
    .bind(&auth_type)
    .bind(&status)
    .bind(&now)
    .bind(&now)
    .execute(&state.pool)
    .await?;

    let user = User {
        id: id.clone(),
        email: payload.email,
        name: payload.name,
        password_hash: Some(pw_hash),
        role,
        auth_type,
        status,
        created_at: now.clone(),
        updated_at: now,
    };

    let token = create_jwt(&user)?;

    Ok((
        StatusCode::CREATED,
        Json(AuthResponse {
            token,
            user: user.to_dto(),
        }),
    ))
}

#[utoipa::path(
    post,
    path = "/api/auth/login",
    request_body = LoginRequest,
    responses(
        (status = 200, description = "Login successful", body = AuthResponse),
        (status = 401, description = "Invalid credentials")
    )
)]
pub async fn login(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, AppError> {
    let user: Option<User> = sqlx::query_as(
        "SELECT id, email, name, password_hash, role, auth_type, status, created_at, updated_at FROM users WHERE email = ?"
    )
    .bind(&payload.email)
    .fetch_optional(&state.pool)
    .await?;

    let user = user.ok_or_else(|| {
        AppError::Unauthorized("이메일 또는 비밀번호가 올바르지 않습니다".to_string())
    })?;

    if let Some(hash_str) = &user.password_hash {
        let parsed_hash = PasswordHash::new(hash_str)
            .map_err(|_| AppError::Internal(anyhow::anyhow!("Invalid stored password hash")))?;

        Argon2::default()
            .verify_password(payload.password.as_bytes(), &parsed_hash)
            .map_err(|_| {
                AppError::Unauthorized("이메일 또는 비밀번호가 올바르지 않습니다".to_string())
            })?;
    } else {
        return Err(AppError::Unauthorized(
            "SSO 전용 계정입니다. SSO 로그인을 이용해주세요".to_string(),
        ));
    }

    let token = create_jwt(&user)?;

    Ok(Json(AuthResponse {
        token,
        user: user.to_dto(),
    }))
}

#[utoipa::path(
    get,
    path = "/api/auth/me",
    responses(
        (status = 200, description = "Current authenticated user", body = UserDto),
        (status = 401, description = "Unauthorized")
    )
)]
pub async fn get_current_user(
    auth: AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<UserDto>, AppError> {
    let user: Option<User> = sqlx::query_as(
        "SELECT id, email, name, password_hash, role, auth_type, status, created_at, updated_at FROM users WHERE id = ?"
    )
    .bind(&auth.id)
    .fetch_optional(&state.pool)
    .await?;

    match user {
        Some(u) => Ok(Json(u.to_dto())),
        None => Err(AppError::NotFound("User record not found".to_string())),
    }
}

// -----------------------------------------------------------------------------
// 2. Standard Backoffice / Admin Management Endpoints
// -----------------------------------------------------------------------------

#[utoipa::path(
    get,
    path = "/api/admin/users",
    responses(
        (status = 200, description = "List all enterprise users", body = Vec<UserDto>),
        (status = 403, description = "Forbidden: Admin only")
    )
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
    )
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
    )
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
    )
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
    )
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

// -----------------------------------------------------------------------------
// 3. System Health & ERP / SIEM Endpoints
// -----------------------------------------------------------------------------

#[utoipa::path(
    get,
    path = "/api/health",
    responses(
        (status = 200, description = "System health status", body = HealthResponse)
    )
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
    path = "/api/orders",
    params(
        ("search" = Option<String>, Query, description = "Keyword filter"),
        ("status" = Option<String>, Query, description = "Order status filter"),
        ("limit" = Option<i64>, Query, description = "Pagination limit"),
        ("offset" = Option<i64>, Query, description = "Pagination offset")
    ),
    responses(
        (status = 200, description = "List of filtered orders", body = Vec<Order>)
    )
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
    )
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
    )
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
    )
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
    )
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

#[utoipa::path(
    get,
    path = "/api/audit-logs",
    responses(
        (status = 200, description = "List of system audit logs", body = Vec<AuditLog>)
    )
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

fn rand_number() -> u32 {
    use std::time::SystemTime;
    let nanos = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    (nanos % 9000) + 1000
}
