pub mod admin;
pub mod auth;
pub mod system;

use sqlx::SqlitePool;
use std::sync::atomic::AtomicU64;

pub struct AppState {
    pub pool: SqlitePool,
    pub start_time: std::time::Instant,
    pub request_count: AtomicU64,
}

pub(crate) fn rand_number() -> u32 {
    use std::time::SystemTime;
    let nanos = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    (nanos % 9000) + 1000
}
