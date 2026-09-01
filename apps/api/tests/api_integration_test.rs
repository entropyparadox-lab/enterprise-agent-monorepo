use api::{
    create_app_router,
    db::init_db_pool,
    handlers::AppState,
    models::{ApiKeyInfo, AuthResponse, CreateApiKeyResponse, HealthResponse, UserDto},
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
async fn test_auth_register_and_login() {
    let app = setup_test_app().await;

    // 1. Register new user
    let reg_payload = serde_json::json!({
        "email": "testuser@enterprise.local",
        "name": "홍길동",
        "password": "Password123!"
    });

    let reg_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/register")
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::to_vec(&reg_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(reg_res.status(), StatusCode::CREATED);
    let body = reg_res.into_body().collect().await.unwrap().to_bytes();
    let auth: AuthResponse = serde_json::from_slice(&body).unwrap();
    assert_eq!(auth.user.email, "testuser@enterprise.local");
    assert_eq!(auth.user.role, "Viewer"); // Default role
    assert!(!auth.token.is_empty());

    // 2. Login with registered user
    let login_payload = serde_json::json!({
        "email": "testuser@enterprise.local",
        "password": "Password123!"
    });

    let login_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::to_vec(&login_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(login_res.status(), StatusCode::OK);
    let body = login_res.into_body().collect().await.unwrap().to_bytes();
    let auth_login: AuthResponse = serde_json::from_slice(&body).unwrap();
    assert_eq!(auth_login.user.id, auth.user.id);

    // 3. Query /api/auth/me with Bearer token
    let me_res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/auth/me")
                .header("Authorization", format!("Bearer {}", auth_login.token))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(me_res.status(), StatusCode::OK);
    let body = me_res.into_body().collect().await.unwrap().to_bytes();
    let me: UserDto = serde_json::from_slice(&body).unwrap();
    assert_eq!(me.email, "testuser@enterprise.local");
}

#[tokio::test]
async fn test_rbac_admin_guard_blocks_viewer() {
    let app = setup_test_app().await;

    // 1. Login as Viewer
    let viewer_login = serde_json::json!({
        "email": "guest@enterprise.local",
        "password": "AdminPass123!"
    });

    let login_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::to_vec(&viewer_login).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    let body = login_res.into_body().collect().await.unwrap().to_bytes();
    let auth: AuthResponse = serde_json::from_slice(&body).unwrap();
    assert_eq!(auth.user.role, "Viewer");

    // 2. Viewer attempts to access Admin endpoint -> 403 Forbidden
    let admin_res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/admin/users")
                .header("Authorization", format!("Bearer {}", auth.token))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(admin_res.status(), StatusCode::FORBIDDEN);

    // 3. Login as Admin
    let admin_login = serde_json::json!({
        "email": "admin@enterprise.local",
        "password": "AdminPass123!"
    });

    let admin_login_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::to_vec(&admin_login).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    let body = admin_login_res
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    let admin_auth: AuthResponse = serde_json::from_slice(&body).unwrap();
    assert_eq!(admin_auth.user.role, "Admin");

    // 4. Admin accesses /api/admin/users -> 200 OK
    let admin_ok_res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/admin/users")
                .header("Authorization", format!("Bearer {}", admin_auth.token))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(admin_ok_res.status(), StatusCode::OK);
    let body = admin_ok_res.into_body().collect().await.unwrap().to_bytes();
    let users: Vec<UserDto> = serde_json::from_slice(&body).unwrap();
    assert!(users.len() >= 3);
}

#[tokio::test]
async fn test_api_key_creation_and_m2m_auth() {
    let app = setup_test_app().await;

    // Login as Admin
    let admin_login = serde_json::json!({
        "email": "admin@enterprise.local",
        "password": "AdminPass123!"
    });

    let admin_login_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::to_vec(&admin_login).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    let body = admin_login_res
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    let admin_auth: AuthResponse = serde_json::from_slice(&body).unwrap();

    // Create M2M API Key
    let key_payload = serde_json::json!({
        "name": "Hermes CI Worker Bot",
        "role": "Admin"
    });

    let create_key_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/admin/api-keys")
                .header("Authorization", format!("Bearer {}", admin_auth.token))
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::to_vec(&key_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(create_key_res.status(), StatusCode::CREATED);
    let body = create_key_res
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    let key_resp: CreateApiKeyResponse = serde_json::from_slice(&body).unwrap();
    assert!(key_resp.raw_key.starts_with("ep_live_"));

    // Authenticate using the newly created M2M raw API Key on Admin endpoint
    let m2m_res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/admin/api-keys")
                .header("Authorization", format!("Bearer {}", key_resp.raw_key))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(m2m_res.status(), StatusCode::OK);
    let body = m2m_res.into_body().collect().await.unwrap().to_bytes();
    let keys: Vec<ApiKeyInfo> = serde_json::from_slice(&body).unwrap();
    assert!(keys.len() >= 2);
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

// Invariant Property-Based Testing
proptest! {
    #![proptest_config(ProptestConfig::with_cases(20))]
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
