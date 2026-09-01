pub mod core;
pub mod modules;
pub mod openapi;

pub use core::handlers::AppState;
pub use openapi::ApiDoc;

use axum::routing::{delete, get, post, put};
use axum::Router;
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

    // 1. Core Endpoints Router
    let core_router = Router::new()
        // Auth
        .route("/api/auth/register", post(core::handlers::auth::register))
        .route("/api/auth/login", post(core::handlers::auth::login))
        .route("/api/auth/me", get(core::handlers::auth::get_current_user))
        // Backoffice / Admin
        .route(
            "/api/admin/users",
            get(core::handlers::admin::list_admin_users),
        )
        .route(
            "/api/admin/users/{id}/role",
            put(core::handlers::admin::update_user_role),
        )
        .route(
            "/api/admin/api-keys",
            get(core::handlers::admin::list_api_keys).post(core::handlers::admin::create_api_key),
        )
        .route(
            "/api/admin/api-keys/{id}",
            delete(core::handlers::admin::revoke_api_key),
        )
        // System Health & Audit
        .route("/api/health", get(core::handlers::system::get_health))
        .route(
            "/api/audit-logs",
            get(core::handlers::system::list_audit_logs),
        )
        .with_state(state.clone());

    // 2. Business Modules Router (e.g. sample_record / orders)
    let modules_router = modules::sample_record::router().with_state(state);

    Router::new()
        .merge(core_router)
        .merge(modules_router)
        .merge(SwaggerUi::new("/swagger-ui").url("/api/openapi.json", ApiDoc::openapi()))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
}
