use crate::handlers;
use crate::models;
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    paths(
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
            models::HealthResponse,
            models::Order,
            models::CreateOrderRequest,
            models::UpdateOrderRequest,
            models::AuditLog,
            crate::error::ErrorResponse,
        )
    ),
    tags(
        (name = "enterprise-api", description = "Enterprise Vibe-Coding Backend API")
    )
)]
pub struct ApiDoc;
