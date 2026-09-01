use crate::core::error::AppError;
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};
use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous},
    SqlitePool,
};
use std::str::FromStr;

pub async fn init_db_pool(db_url: &str) -> Result<SqlitePool, AppError> {
    let opts = SqliteConnectOptions::from_str(db_url)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Invalid DB URL: {}", e)))?
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
        .busy_timeout(std::time::Duration::from_secs(5));

    let pool = SqlitePoolOptions::new()
        .max_connections(20)
        .connect_with(opts)
        .await?;

    run_core_migrations(&pool).await?;
    crate::modules::sample_record::run_migrations(&pool).await?;

    Ok(pool)
}

async fn run_core_migrations(pool: &SqlitePool) -> Result<(), AppError> {
    // 1. Users Table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            password_hash TEXT,
            role TEXT NOT NULL DEFAULT 'Viewer',
            auth_type TEXT NOT NULL DEFAULT 'Password',
            status TEXT NOT NULL DEFAULT 'Active',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
        "#,
    )
    .execute(pool)
    .await?;

    // 2. API Keys Table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS api_keys (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            key_prefix TEXT NOT NULL,
            key_hash TEXT NOT NULL UNIQUE,
            role TEXT NOT NULL DEFAULT 'Operator',
            created_at TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1
        );
        CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
        "#,
    )
    .execute(pool)
    .await?;

    // 3. Audit Logs Table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            log_type TEXT NOT NULL,
            user_name TEXT NOT NULL,
            action TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'SUCCESS',
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
        "#,
    )
    .execute(pool)
    .await?;

    // 4. Seed initial admin user if empty
    let user_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await?;

    if user_count.0 == 0 {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let pw_hash = argon2
            .hash_password(b"AdminPass123!", &salt)
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Argon2 hash failed: {}", e)))?
            .to_string();

        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

        sqlx::query(
            r#"
            INSERT INTO users (id, email, name, password_hash, role, auth_type, status, created_at, updated_at)
            VALUES 
            ('USR-0001', 'admin@enterprise.local', '최고 관리자 (Admin)', ?, 'Admin', 'Password', 'Active', ?, ?),
            ('USR-0002', 'operator@enterprise.local', '운영 리드 (Operator)', ?, 'Operator', 'Password', 'Active', ?, ?),
            ('USR-0003', 'guest@enterprise.local', '조회 전용 (Viewer)', ?, 'Viewer', 'Password', 'Active', ?, ?)
            "#,
        )
        .bind(&pw_hash)
        .bind(&now)
        .bind(&now)
        .bind(&pw_hash)
        .bind(&now)
        .bind(&now)
        .bind(&pw_hash)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        // Seed default M2M API key
        let hash = sha256_hex("ep_live_a1b2c3d4e5f6");
        sqlx::query(
            r#"
            INSERT INTO api_keys (id, name, key_prefix, key_hash, role, created_at, is_active)
            VALUES ('KEY-0001', 'Hermes Agent Autonomous CI Worker', 'ep_live_a1b2', ?, 'Admin', ?, 1)
            "#,
        )
        .bind(hash)
        .bind(&now)
        .execute(pool)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO audit_logs (log_type, user_name, action, status, created_at) VALUES
            ('deploy', '성호 (DevOps)', 'Cluster #04 zgate hot-patch applied', 'SUCCESS', '2026-09-01 12:00:00'),
            ('security', 'Security Guard', 'Blocked unauthenticated RPC request from 203.0.113.42', 'BLOCKED', '2026-09-01 11:45:00');
            "#,
        )
        .execute(pool)
        .await?;
    }

    Ok(())
}

pub fn sha256_hex(input: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    format!("{:x}", hasher.finalize())
}
