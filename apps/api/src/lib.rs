pub mod auth;
pub mod db;
pub mod error;
pub mod handlers;
pub mod models;
pub mod openapi;

use axum::routing::{delete, get, post, put};
use axum::Router;
pub use handlers::AppState;
pub use openapi::ApiDoc;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

pub fn create_app_router(state: Arc<AppState>) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let api_router = Router::new()
        // Auth routes
        .route("/api/auth/register", post(handlers::register))
        .route("/api/auth/login", post(handlers::login))
        .route("/api/auth/me", get(handlers::get_current_user))
        // Backoffice / Admin routes
        .route("/api/admin/users", get(handlers::list_admin_users))
        .route(
            "/api/admin/users/{id}/role",
            put(handlers::update_user_role),
        )
        .route(
            "/api/admin/api-keys",
            get(handlers::list_api_keys).post(handlers::create_api_key),
        )
        .route("/api/admin/api-keys/{id}", delete(handlers::revoke_api_key))
        // System & Business Core routes
        .route("/api/health", get(handlers::get_health))
        .route(
            "/api/orders",
            get(handlers::list_orders).post(handlers::create_order),
        )
        .route(
            "/api/orders/{id}",
            get(handlers::get_order)
                .put(handlers::update_order)
                .delete(handlers::delete_order),
        )
        .route("/api/audit-logs", get(handlers::list_audit_logs))
        .with_state(state);

    Router::new()
        .merge(api_router)
        .merge(SwaggerUi::new("/swagger-ui").url("/api/openapi.json", ApiDoc::openapi()))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
}
