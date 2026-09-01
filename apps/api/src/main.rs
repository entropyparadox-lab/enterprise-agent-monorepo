mod db;
mod error;
mod handlers;
mod models;
mod openapi;

use axum::{routing::get, Router};
use clap::Parser;
use handlers::AppState;
use openapi::ApiDoc;
use std::net::SocketAddr;
use std::sync::atomic::AtomicU64;
use std::sync::Arc;
use tokio::signal;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

#[derive(Parser, Debug)]
#[command(author, version, about = "Enterprise Agent-Native Backend Service")]
pub struct Cli {
    #[arg(short, long, env = "PORT", default_value = "8080")]
    pub port: u16,

    #[arg(
        short,
        long,
        env = "DATABASE_URL",
        default_value = "sqlite://enterprise.db"
    )]
    pub db_url: String,

    #[arg(long, default_value_t = false)]
    pub export_openapi: bool,
}

pub fn create_router(state: Arc<AppState>) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let api_router = Router::new()
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

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    // If --export-openapi is requested, dump OpenAPI JSON to stdout and exit
    if cli.export_openapi {
        let doc = ApiDoc::openapi();
        println!("{}", doc.to_pretty_json()?);
        return Ok(());
    }

    // Initialize tracing subscriber
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "api=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Initializing SQLite WAL connection pool at {}", cli.db_url);
    let pool = db::init_db_pool(&cli.db_url).await?;

    let state = Arc::new(AppState {
        pool,
        start_time: std::time::Instant::now(),
        request_count: AtomicU64::new(0),
    });

    let app = create_router(state);
    let addr = SocketAddr::from(([0, 0, 0, 0], cli.port));
    tracing::info!("🦀 Axum 0.8 Enterprise API listening on http://{}", addr);
    tracing::info!("📖 Swagger UI available at http://{}/swagger-ui", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    tracing::info!("🛑 Server shut down gracefully. SQLite WAL flushed.");
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {
            tracing::info!("Received SIGINT (Ctrl+C) signal.");
        },
        _ = terminate => {
            tracing::info!("Received SIGTERM signal from MOS / Orchestrator.");
        },
    }
}
