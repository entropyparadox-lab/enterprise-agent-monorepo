use crate::core::{
    auth::{create_jwt, AuthUser},
    error::AppError,
    handlers::{rand_number, AppState},
    models::{AuthResponse, LoginRequest, RegisterRequest, User, UserDto},
};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{extract::State, http::StatusCode, Json};
use std::sync::Arc;

#[utoipa::path(
    post,
    path = "/api/auth/register",
    request_body = RegisterRequest,
    responses(
        (status = 201, description = "User registered successfully", body = AuthResponse),
        (status = 400, description = "Bad request or email already exists")
    ),
    tag = "auth"
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
    let role = "Viewer".to_string();
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
    ),
    tag = "auth"
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
    ),
    tag = "auth"
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
