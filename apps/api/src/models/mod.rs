use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, ToSchema, PartialEq, Eq, Clone)]
pub enum UserRole {
    Admin,
    Operator,
    Viewer,
}

impl ToString for UserRole {
    fn to_string(&self) -> String {
        match self {
            UserRole::Admin => "Admin".to_string(),
            UserRole::Operator => "Operator".to_string(),
            UserRole::Viewer => "Viewer".to_string(),
        }
    }
}

impl From<&str> for UserRole {
    fn from(s: &str) -> Self {
        match s {
            "Admin" => UserRole::Admin,
            "Operator" => UserRole::Operator,
            _ => UserRole::Viewer,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, ToSchema, Clone)]
pub struct UserDto {
    pub id: String,
    pub email: String,
    pub name: String,
    pub role: String,
    pub auth_type: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct User {
    pub id: String,
    pub email: String,
    pub name: String,
    pub password_hash: Option<String>,
    pub role: String,
    pub auth_type: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

impl User {
    pub fn to_dto(&self) -> UserDto {
        UserDto {
            id: self.id.clone(),
            email: self.email.clone(),
            name: self.name.clone(),
            role: self.role.clone(),
            auth_type: self.auth_type.clone(),
            status: self.status.clone(),
            created_at: self.created_at.clone(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RegisterRequest {
    pub email: String,
    pub name: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserDto,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpdateUserRoleRequest {
    pub role: String,
}

#[derive(Debug, Serialize, Deserialize, FromRow, ToSchema, Clone)]
pub struct ApiKeyInfo {
    pub id: String,
    pub name: String,
    pub key_prefix: String,
    pub role: String,
    pub created_at: String,
    pub is_active: bool,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateApiKeyRequest {
    pub name: String,
    pub role: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateApiKeyResponse {
    pub raw_key: String,
    pub key_info: ApiKeyInfo,
}

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

#[derive(Debug, Serialize, Deserialize, FromRow, ToSchema, Clone)]
pub struct AuditLog {
    pub id: i64,
    pub log_type: String,
    pub user_name: String,
    pub action: String,
    pub status: String,
    pub created_at: String,
}
