pub mod db;
pub mod error;
pub mod handlers;
pub mod models;
pub mod openapi;

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
        .route("/api/health", axum::routing::get(handlers::get_health))
        .route(
            "/api/orders",
            axum::routing::get(handlers::list_orders).post(handlers::create_order),
        )
        .route(
            "/api/orders/{id}",
            axum::routing::get(handlers::get_order)
                .put(handlers::update_order)
                .delete(handlers::delete_order),
        )
        .route(
            "/api/audit-logs",
            axum::routing::get(handlers::list_audit_logs),
        )
        .with_state(state);

    Router::new()
        .merge(api_router)
        .merge(SwaggerUi::new("/swagger-ui").url("/api/openapi.json", ApiDoc::openapi()))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
}
