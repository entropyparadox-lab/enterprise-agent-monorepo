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
use proptest::prelude::*;
use std::sync::atomic::AtomicU64;
use std::sync::Arc;
use tower::ServiceExt;

async fn setup_test_app() -> axum::Router {
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
    let body = create_response
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
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

// 🛡️ Invariant Property-Based Testing
proptest! {
    #[test]
    fn test_order_validation_invariants(
        client in "[a-zA-Z가-힣0-9 ]{0,30}",
        amount in -1000i64..10_000_000i64
    ) {
        let is_valid = !client.trim().is_empty() && amount > 0;
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let app = setup_test_app().await;
            let payload = serde_json::json!({
                "client": client,
                "items": "Invariant test item",
                "amount": amount,
            });

            let res = app.oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/orders")
                    .header("Content-Type", "application/json")
                    .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                    .unwrap()
            ).await.unwrap();

            if is_valid {
                prop_assert_eq!(res.status(), StatusCode::CREATED);
            } else {
                prop_assert_eq!(res.status(), StatusCode::BAD_REQUEST);
            }
            Ok(())
        })?;
    }
}

#[tokio::test]
async fn test_sqlite_wal_concurrent_writes() {
    let app = setup_test_app().await;
    let mut handles = Vec::new();

    for i in 0..30 {
        let app_clone = app.clone();
        let handle = tokio::spawn(async move {
            let payload = serde_json::json!({
                "client": format!("동시성 고객사 #{}", i),
                "items": "동시 수주 스트레스 테스트",
                "amount": 1000000 + (i * 10000) as i64,
                "priority": "보통"
            });

            let res = app_clone
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/orders")
                        .header("Content-Type", "application/json")
                        .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(res.status(), StatusCode::CREATED);
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.await.unwrap();
    }
}
