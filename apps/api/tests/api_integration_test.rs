use api::{
    create_app_router,
    db::init_db_pool,
    handlers::AppState,
    models::{HealthResponse, Order},
};
use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use http_body_util::BodyExt;
use std::sync::atomic::AtomicU64;
use std::sync::Arc;
use tower::ServiceExt;

async fn setup_test_app() -> axum::Router {
    // In-memory SQLite with WAL for isolated parallel test execution
    let pool = init_db_pool("sqlite::memory:")
        .await
        .expect("Failed to initialize test DB pool");

    let state = Arc::new(AppState {
        pool,
        start_time: std::time::Instant::now(),
        request_count: AtomicU64::new(0),
    });

    create_app_router(state)
}

#[tokio::test]
async fn test_health_check() {
    let app = setup_test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let health: HealthResponse = serde_json::from_slice(&body).unwrap();
    assert_eq!(health.status, "HEALTHY");
}

#[tokio::test]
async fn test_list_orders_and_create_order() {
    let app = setup_test_app().await;

    // 1. Initial list orders (seeded data)
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/orders")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let orders: Vec<Order> = serde_json::from_slice(&body).unwrap();
    assert!(!orders.is_empty(), "Initial seeded orders should exist");

    // 2. Create a new order
    let new_order_json = serde_json::json!({
        "client": "테스트 기업",
        "items": "통합 검증 스위트 1EA",
        "amount": 5500000,
        "priority": "높음"
    });

    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/orders")
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::to_vec(&new_order_json).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(create_response.status(), StatusCode::CREATED);
    let body = create_response.into_body().collect().await.unwrap().to_bytes();
    let created: Order = serde_json::from_slice(&body).unwrap();
    assert_eq!(created.client, "테스트 기업");
    assert_eq!(created.amount, 5500000);
}

#[tokio::test]
async fn test_order_not_found_returns_404() {
    let app = setup_test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/orders/ORD-9999-NOTEXIST")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}
