use crate::core::handlers;
use crate::core::models;
use crate::modules::sample_record::{handlers as sample_handlers, models as sample_models};
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    paths(
        // Core: Auth & Admin
        handlers::auth::register,
        handlers::auth::login,
        handlers::auth::get_current_user,
        handlers::admin::list_admin_users,
        handlers::admin::update_user_role,
        handlers::admin::list_api_keys,
        handlers::admin::create_api_key,
        handlers::admin::revoke_api_key,
        // Core: System Telemetry
        handlers::system::get_health,
        handlers::system::list_audit_logs,
        // Modules: Sample Record (Orders)
        sample_handlers::list_orders,
        sample_handlers::get_order,
        sample_handlers::create_order,
        sample_handlers::update_order,
        sample_handlers::delete_order,
    ),
    components(
        schemas(
            // Core schemas
            models::RegisterRequest,
            models::LoginRequest,
            models::AuthResponse,
            models::UserDto,
            models::UpdateUserRoleRequest,
            models::ApiKeyInfo,
            models::CreateApiKeyRequest,
            models::CreateApiKeyResponse,
            models::HealthResponse,
            models::AuditLog,
            crate::core::error::ErrorResponse,
            // Module schemas
            sample_models::Order,
            sample_models::CreateOrderRequest,
            sample_models::UpdateOrderRequest,
        )
    ),
    tags(
        (name = "auth", description = "Core Authentication & Sessions"),
        (name = "admin", description = "Core Backoffice & RBAC"),
        (name = "system", description = "Core Health & System Telemetry"),
        (name = "orders", description = "Sample Business Domain Module (Reference CRUD)")
    )
)]
pub struct ApiDoc;
