use crate::{
    db::sha256_hex,
    error::AppError,
    handlers::AppState,
    models::{User, UserRole},
};
use axum::{extract::FromRequestParts, http::request::Parts};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

const JWT_SECRET: &[u8] = b"enterprise-agent-monorepo-super-secret-jwt-key-2026";

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub email: String,
    pub name: String,
    pub role: String,
    pub exp: usize,
}

pub fn create_jwt(user: &User) -> Result<String, AppError> {
    let expiration = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::days(7))
        .expect("valid timestamp")
        .timestamp() as usize;

    let claims = Claims {
        sub: user.id.clone(),
        email: user.email.clone(),
        name: user.name.clone(),
        role: user.role.clone(),
        exp: expiration,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(JWT_SECRET),
    )
    .map_err(|e| AppError::Internal(anyhow::anyhow!("JWT creation failed: {}", e)))
}

pub fn verify_jwt(token: &str) -> Result<Claims, AppError> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(JWT_SECRET),
        &Validation::default(),
    )
    .map(|data| data.claims)
    .map_err(|_| AppError::Unauthorized("Invalid or expired authentication token".to_string()))
}

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub id: String,
    pub email: String,
    pub name: String,
    pub role: UserRole,
}

impl FromRequestParts<Arc<AppState>> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &Arc<AppState>,
    ) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get("Authorization")
            .and_then(|v| v.to_str().ok());

        if let Some(header) = auth_header {
            if let Some(token) = header.strip_prefix("Bearer ") {
                let token = token.trim();

                // 1. M2M API Key validation (ep_live_...)
                if token.starts_with("ep_live_") {
                    let hash = sha256_hex(token);
                    let row: Option<(String, String, String)> = sqlx::query_as(
                        "SELECT id, name, role FROM api_keys WHERE key_hash = ? AND is_active = 1",
                    )
                    .bind(&hash)
                    .fetch_optional(&state.pool)
                    .await
                    .map_err(AppError::Database)?;

                    if let Some((key_id, name, role)) = row {
                        return Ok(AuthUser {
                            id: key_id,
                            email: format!("m2m-{}@agent.local", name),
                            name,
                            role: UserRole::from(role.as_str()),
                        });
                    }
                    return Err(AppError::Unauthorized("Invalid M2M API Key".to_string()));
                }

                // 2. Standard JWT token validation
                let claims = verify_jwt(token)?;
                return Ok(AuthUser {
                    id: claims.sub,
                    email: claims.email,
                    name: claims.name,
                    role: UserRole::from(claims.role.as_str()),
                });
            }
        }

        // 3. Fallback: Guest / Default for public demo endpoints if unauthenticated
        Err(AppError::Unauthorized(
            "Missing Bearer authentication token".to_string(),
        ))
    }
}

pub struct AdminUser(pub AuthUser);

impl FromRequestParts<Arc<AppState>> for AdminUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &Arc<AppState>,
    ) -> Result<Self, Self::Rejection> {
        let user = AuthUser::from_request_parts(parts, state).await?;
        if user.role != UserRole::Admin {
            return Err(AppError::Forbidden(
                "Access denied: Admin privileges required".to_string(),
            ));
        }
        Ok(AdminUser(user))
    }
}
