use crate::handlers;
use crate::models;
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    paths(
        handlers::register,
        handlers::login,
        handlers::get_current_user,
        handlers::list_admin_users,
        handlers::update_user_role,
        handlers::list_api_keys,
        handlers::create_api_key,
        handlers::revoke_api_key,
        handlers::get_health,
        handlers::list_orders,
        handlers::get_order,
        handlers::create_order,
        handlers::update_order,
        handlers::delete_order,
        handlers::list_audit_logs,
    ),
    components(
        schemas(
            models::RegisterRequest,
            models::LoginRequest,
            models::AuthResponse,
            models::UserDto,
            models::UpdateUserRoleRequest,
            models::ApiKeyInfo,
            models::CreateApiKeyRequest,
            models::CreateApiKeyResponse,
            models::HealthResponse,
            models::Order,
            models::CreateOrderRequest,
            models::UpdateOrderRequest,
            models::AuditLog,
            crate::error::ErrorResponse,
        )
    ),
    tags(
        (name = "auth", description = "Authentication & User Sessions"),
        (name = "admin", description = "Enterprise Backoffice & Permissions"),
        (name = "orders", description = "ERP & Business Core"),
        (name = "system", description = "Health & Telemetry")
    )
)]
pub struct ApiDoc;
