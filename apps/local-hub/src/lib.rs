//! Contract foundation for the Nexora Local Hub.
//!
//! The service runtime is deliberately fail-closed: loopback is the default and
//! LAN publication requires validated TLS, identity, pairing and authorization.

use axum::{
    Json, Router,
    extract::{Query, State},
    http::{HeaderMap, StatusCode, Uri, header},
    response::IntoResponse,
    response::Response,
    routing::get,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet, VecDeque};
use std::io::Cursor;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use subtle::ConstantTimeEq;
use tokio::sync::{Mutex, RwLock, oneshot};
use tokio::task::JoinHandle;

mod sqlite_sync;
pub use sqlite_sync::{DurableSyncError, SqliteSyncOperationStore, SyncBootstrapSnapshot};

pub const API_VERSION: u16 = 1;
pub const DEFAULT_PORT: u16 = 43_173;

#[derive(Clone)]
pub struct LocalHubState {
    pub pairing: Arc<RwLock<PairingRegistry>>,
    pub rate_limiter: Arc<Mutex<RateLimiter>>,
    pub runtime: Arc<RwLock<HubRuntimeStatus>>,
    /// Optional browser entry point published only after explicit host setup.
    pub app_url: Option<String>,
    /// Root directory for the versioned local browser build, if published.
    pub browser_root: Option<PathBuf>,
    pub sync: Arc<Mutex<SyncTransport>>,
    pub durable_sync: Option<Arc<Mutex<SqliteSyncOperationStore>>>,
    pub sync_status: Arc<RwLock<SyncRuntimeStatus>>,
    pub sessions: Arc<Mutex<PasscodeSessionRegistry>>,
}

impl Default for LocalHubState {
    fn default() -> Self {
        Self {
            pairing: Arc::new(RwLock::new(PairingRegistry::default())),
            rate_limiter: Arc::new(Mutex::new(RateLimiter::new(60, 60_000))),
            runtime: Arc::new(RwLock::new(HubRuntimeStatus::default())),
            app_url: None,
            browser_root: None,
            sync: Arc::new(Mutex::new(SyncTransport::default())),
            durable_sync: None,
            sync_status: Arc::new(RwLock::new(SyncRuntimeStatus::default())),
            sessions: Arc::new(Mutex::new(PasscodeSessionRegistry::default())),
        }
    }
}

pub fn router(state: LocalHubState) -> Router {
    Router::new()
        .route("/v1/health", get(health))
        .route("/v1/pairing/redeem", axum::routing::post(redeem_pairing))
        .route("/v1/pairing/revoke", axum::routing::post(revoke_pairing))
        .route("/v1/authorize", get(authorize))
        .route(
            "/v1/session/configure",
            axum::routing::post(configure_session),
        )
        .route("/v1/session/unlock", axum::routing::post(unlock_session))
        .route("/v1/session/logout", axum::routing::post(logout_session))
        .route(
            "/v1/operations",
            axum::routing::get(pull_operations).post(push_operations),
        )
        .route("/v1/bootstrap", get(bootstrap_sync))
        .fallback(browser_asset)
        .with_state(state)
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SessionUnlockRequest {
    pub device_id: String,
    pub device_token: String,
    pub passcode: String,
    pub session_token: String,
    pub now_ms: u64,
    pub ttl_ms: u64,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SessionConfigureRequest {
    pub device_id: String,
    pub device_token: String,
    pub passcode: String,
    pub salt: Vec<u8>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SessionLogoutRequest {
    pub device_id: String,
    pub session_token: String,
    pub now_ms: u64,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct PairingRevokeRequest {
    pub requester_device_id: String,
    pub requester_device_token: String,
    pub target_device_id: String,
}

async fn revoke_pairing(
    State(state): State<LocalHubState>,
    Json(request): Json<PairingRevokeRequest>,
) -> impl IntoResponse {
    if state
        .pairing
        .read()
        .await
        .authorize(
            &request.requester_device_id,
            &request.requester_device_token,
        )
        .is_err()
    {
        return StatusCode::UNAUTHORIZED;
    }
    if !state
        .pairing
        .write()
        .await
        .revoke(&request.target_device_id)
    {
        return StatusCode::NOT_FOUND;
    }
    state
        .sessions
        .lock()
        .await
        .revoke_device(&request.target_device_id);
    StatusCode::NO_CONTENT
}

async fn configure_session(
    State(state): State<LocalHubState>,
    Json(request): Json<SessionConfigureRequest>,
) -> impl IntoResponse {
    if state
        .pairing
        .read()
        .await
        .authorize(&request.device_id, &request.device_token)
        .is_err()
    {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "unauthorized" })),
        );
    }
    match state
        .sessions
        .lock()
        .await
        .configure(&request.passcode, &request.salt, 5, 60_000)
    {
        Ok(()) => (
            StatusCode::OK,
            Json(serde_json::json!({ "status": "configured" })),
        ),
        Err(SessionError::InvalidPasscode) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "invalid_passcode" })),
        ),
        _ => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "invalid_session_configuration" })),
        ),
    }
}

async fn unlock_session(
    State(state): State<LocalHubState>,
    Json(request): Json<SessionUnlockRequest>,
) -> impl IntoResponse {
    if state
        .pairing
        .read()
        .await
        .authorize(&request.device_id, &request.device_token)
        .is_err()
    {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "unauthorized" })),
        );
    }
    let result = state.sessions.lock().await.unlock(
        &request.device_id,
        &request.passcode,
        &request.session_token,
        now_ms(),
        request.ttl_ms,
    );
    match result {
        Ok(()) => (
            StatusCode::OK,
            Json(serde_json::json!({ "status": "unlocked" })),
        ),
        Err(SessionError::NotConfigured) => (
            StatusCode::CONFLICT,
            Json(serde_json::json!({ "error": "passcode_not_configured" })),
        ),
        Err(SessionError::RateLimited) => (
            StatusCode::TOO_MANY_REQUESTS,
            Json(serde_json::json!({ "error": "rate_limited" })),
        ),
        Err(SessionError::InvalidPasscode) => (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "invalid_passcode" })),
        ),
        Err(SessionError::InvalidSession) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "invalid_session" })),
        ),
        Err(SessionError::UnknownDevice | SessionError::Expired) => (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "unauthorized" })),
        ),
    }
}

async fn logout_session(
    State(state): State<LocalHubState>,
    Json(request): Json<SessionLogoutRequest>,
) -> impl IntoResponse {
    let mut sessions = state.sessions.lock().await;
    if sessions
        .authenticate(&request.device_id, &request.session_token, now_ms())
        .is_err()
    {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "unauthorized" })),
        );
    }
    sessions.logout(&request.session_token);
    (
        StatusCode::OK,
        Json(serde_json::json!({ "status": "logged_out" })),
    )
}

async fn browser_asset(State(state): State<LocalHubState>, uri: Uri) -> Response {
    let Some(root) = state.browser_root else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let requested = uri.path().trim_start_matches('/');
    let requested = if requested.is_empty() {
        "index.html"
    } else {
        requested
    };
    if requested
        .split('/')
        .any(|segment| segment == ".." || segment.is_empty())
    {
        return StatusCode::BAD_REQUEST.into_response();
    }
    let candidate = root.join(requested);
    let (served_path, bytes) = match tokio::fs::read(&candidate).await {
        Ok(bytes) => (candidate, bytes),
        Err(_) if !requested.contains('.') => {
            match tokio::fs::read(root.join("index.html")).await {
                Ok(bytes) => (root.join("index.html"), bytes),
                Err(_) => return StatusCode::NOT_FOUND.into_response(),
            }
        }
        Err(_) => return StatusCode::NOT_FOUND.into_response(),
    };
    let content_type = match served_path
        .extension()
        .and_then(|extension| extension.to_str())
    {
        Some("html") => "text/html; charset=utf-8",
        Some("js") => "text/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("json") => "application/json; charset=utf-8",
        Some("svg") => "image/svg+xml",
        _ => "application/octet-stream",
    };
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CACHE_CONTROL, "no-store")
        .body(axum::body::Body::from(bytes))
        .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
}

async fn health(State(state): State<LocalHubState>) -> impl IntoResponse {
    let runtime = state.runtime.read().await.clone();
    let sync = state.sync_status.read().await.clone();
    (
        StatusCode::OK,
        Json(health_response_with_runtime_and_sync(
            state.app_url.as_deref(),
            &runtime,
            &sync,
        )),
    )
}

async fn authorize(State(state): State<LocalHubState>, headers: HeaderMap) -> impl IntoResponse {
    let device_id = match headers
        .get("x-nexora-device-id")
        .and_then(|v| v.to_str().ok())
    {
        Some(value) if !value.is_empty() => value,
        _ => return StatusCode::UNAUTHORIZED.into_response(),
    };
    let bearer = match headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
    {
        Some(value) => value.strip_prefix("Bearer ").unwrap_or(""),
        None => "",
    };
    if bearer.is_empty() {
        return StatusCode::UNAUTHORIZED.into_response();
    }
    if !state.rate_limiter.lock().await.allow(device_id, now_ms()) {
        return StatusCode::TOO_MANY_REQUESTS.into_response();
    }
    match state.pairing.read().await.authorize(device_id, bearer) {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(_) => StatusCode::FORBIDDEN.into_response(),
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct PushOperationsRequest {
    pub delivery_id: String,
    pub operations: Vec<ReplicableOperation>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct PullOperationsResponse {
    pub operations: Vec<(u64, ReplicableOperation)>,
}

#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncRuntimeState {
    #[default]
    Idle,
    Syncing,
    Conflict,
    Offline,
    Error,
}

#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
pub struct SyncRuntimeStatus {
    pub state: SyncRuntimeState,
    pub cursor: u64,
}

async fn push_operations(
    State(state): State<LocalHubState>,
    headers: HeaderMap,
    Json(request): Json<PushOperationsRequest>,
) -> impl IntoResponse {
    let Some(device_id) = authorized_device(&state, &headers).await else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error":"unauthorized"})),
        )
            .into_response();
    };
    let token = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .unwrap_or_default();
    state.sync_status.write().await.state = SyncRuntimeState::Syncing;
    let pairing = state.pairing.read().await;
    let result = if let Some(store) = state.durable_sync.as_ref() {
        match store
            .lock()
            .await
            .push(&request.delivery_id, request.operations)
        {
            Ok(results) => Ok(results),
            Err(DurableSyncError::Transport(error)) => Err(error),
            Err(DurableSyncError::InvalidPayload(_)) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!({"error":"invalid_ledger_payload"})),
                )
                    .into_response();
            }
            Err(DurableSyncError::Sqlite(_) | DurableSyncError::NumericOverflow) => {
                state.sync_status.write().await.state = SyncRuntimeState::Error;
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({"error":"sync_storage_unavailable"})),
                )
                    .into_response();
            }
        }
    } else {
        state.sync.lock().await.push_authorized(
            &pairing,
            device_id,
            token,
            &request.delivery_id,
            request.operations,
        )
    };
    match result {
        Ok(results) => {
            let conflict = results
                .iter()
                .any(|result| matches!(result, OperationApplyResult::Conflict { .. }));
            let mut status = state.sync_status.write().await;
            status.state = if conflict {
                SyncRuntimeState::Conflict
            } else {
                SyncRuntimeState::Idle
            };
            if let Some(cursor) = results.iter().filter_map(operation_cursor).max() {
                status.cursor = status.cursor.max(cursor);
            }
            (StatusCode::OK, Json(results)).into_response()
        }
        Err(TransportError::ReplayDetected) => (
            StatusCode::CONFLICT,
            Json(serde_json::json!({"error":"replay_detected"})),
        )
            .into_response(),
        Err(TransportError::UnauthorizedDevice) => StatusCode::FORBIDDEN.into_response(),
        Err(TransportError::CursorAhead) => StatusCode::BAD_REQUEST.into_response(),
    }
}

async fn bootstrap_sync(
    State(state): State<LocalHubState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if authorized_device(&state, &headers).await.is_none() {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error":"unauthorized"})),
        )
            .into_response();
    }
    let snapshot = if let Some(store) = state.durable_sync.as_ref() {
        match store.lock().await.bootstrap() {
            Ok(snapshot) => snapshot,
            Err(_) => {
                state.sync_status.write().await.state = SyncRuntimeState::Error;
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({"error":"sync_storage_unavailable"})),
                )
                    .into_response();
            }
        }
    } else {
        let operations: Vec<(u64, ReplicableOperation)> = state
            .sync
            .lock()
            .await
            .pull(0)
            .map(|(cursor, operation)| (cursor, operation.clone()))
            .collect();
        let cursor = operations.last().map(|(cursor, _)| *cursor).unwrap_or(0);
        SyncBootstrapSnapshot {
            schema_version: 1,
            cursor,
            operations,
        }
    };
    let mut status = state.sync_status.write().await;
    status.state = SyncRuntimeState::Idle;
    status.cursor = status.cursor.max(snapshot.cursor);
    (StatusCode::OK, Json(snapshot)).into_response()
}

async fn pull_operations(
    State(state): State<LocalHubState>,
    headers: HeaderMap,
    Query(query): Query<CursorQuery>,
) -> impl IntoResponse {
    if authorized_device(&state, &headers).await.is_none() {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error":"unauthorized"})),
        )
            .into_response();
    }
    state.sync_status.write().await.state = SyncRuntimeState::Syncing;
    let operations: Result<Vec<(u64, ReplicableOperation)>, DurableSyncError> =
        if let Some(store) = state.durable_sync.as_ref() {
            store.lock().await.pull(query.after)
        } else {
            Ok(state
                .sync
                .lock()
                .await
                .pull(query.after)
                .map(|(cursor, operation)| (cursor, operation.clone()))
                .collect())
        };
    let operations = match operations {
        Ok(operations) => operations,
        Err(_) => {
            state.sync_status.write().await.state = SyncRuntimeState::Error;
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"sync_storage_unavailable"})),
            )
                .into_response();
        }
    };
    let cursor = operations
        .last()
        .map(|operation| operation.0)
        .unwrap_or(query.after);
    let mut status = state.sync_status.write().await;
    status.state = SyncRuntimeState::Idle;
    status.cursor = status.cursor.max(cursor);
    (StatusCode::OK, Json(PullOperationsResponse { operations })).into_response()
}

fn operation_cursor(result: &OperationApplyResult) -> Option<u64> {
    match result {
        OperationApplyResult::Applied { cursor, .. }
        | OperationApplyResult::Duplicate { cursor, .. } => Some(*cursor),
        OperationApplyResult::Conflict { .. } => None,
    }
}

async fn authorized_device<'a>(state: &LocalHubState, headers: &'a HeaderMap) -> Option<&'a str> {
    let device_id = headers
        .get("x-nexora-device-id")
        .and_then(|value| value.to_str().ok())?;
    let token = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))?;
    if !state.rate_limiter.lock().await.allow(device_id, now_ms()) {
        return None;
    }
    if state
        .pairing
        .read()
        .await
        .authorize(device_id, token)
        .is_err()
    {
        return None;
    }
    let sessions = state.sessions.lock().await;
    if sessions.is_configured() {
        let session_token = headers
            .get("x-nexora-session-token")
            .and_then(|value| value.to_str().ok())?;
        drop(sessions);
        if state
            .sessions
            .lock()
            .await
            .authenticate(device_id, session_token, now_ms())
            .is_err()
        {
            return None;
        }
    }
    Some(device_id)
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct PairingRedeemRequest {
    pub grant_id: String,
    pub code: String,
    pub device_id: String,
    pub device_token: String,
    pub host_fingerprint: String,
}

async fn redeem_pairing(
    State(state): State<LocalHubState>,
    Json(request): Json<PairingRedeemRequest>,
) -> impl IntoResponse {
    if request.grant_id.is_empty()
        || request.device_id.is_empty()
        || request.device_token.len() < 24
    {
        return StatusCode::BAD_REQUEST;
    }
    match state.pairing.write().await.redeem(
        &request.grant_id,
        &request.code,
        request.device_id,
        &request.device_token,
        &request.host_fingerprint,
        now_ms(),
    ) {
        Ok(()) => StatusCode::NO_CONTENT,
        Err(PairingError::Expired | PairingError::AlreadyUsed) => StatusCode::GONE,
        Err(_) => StatusCode::FORBIDDEN,
    }
}

pub async fn serve(
    config: TransportSecurityConfig,
    state: LocalHubState,
) -> Result<(), RuntimeError> {
    let address = config.bind_addr().map_err(RuntimeError::Binding)?;
    let app = router(state);
    if config.binding == BindingMode::Loopback {
        let listener = tokio::net::TcpListener::bind(address)
            .await
            .map_err(RuntimeError::Io)?;
        return axum::serve(listener, app).await.map_err(RuntimeError::Io);
    }
    let tls = config.server_config().map_err(RuntimeError::Tls)?;
    axum_server::bind_rustls(
        address,
        axum_server::tls_rustls::RustlsConfig::from_config(Arc::new(tls)),
    )
    .serve(app.into_make_service())
    .await
    .map_err(RuntimeError::Io)
}

/// Lifecycle state exposed by `/v1/health` and the native controller.
#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum HubLifecycleState {
    #[default]
    Stopped,
    Starting,
    Running,
    Stopping,
    Failed,
}

impl HubLifecycleState {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Stopped => "stopped",
            Self::Starting => "starting",
            Self::Running => "running",
            Self::Stopping => "stopping",
            Self::Failed => "failed",
        }
    }
}

#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
pub struct HubRuntimeStatus {
    pub state: HubLifecycleState,
    pub binding: BindingMode,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address: Option<SocketAddr>,
}

pub struct LocalHubRuntime {
    config: TransportSecurityConfig,
    state: LocalHubState,
    shutdown: Option<oneshot::Sender<()>>,
    task: Option<JoinHandle<Result<(), RuntimeError>>>,
    tls_handle: Option<axum_server::Handle>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingInvite {
    pub endpoint: String,
    pub grant_id: String,
    pub code: String,
    pub host_fingerprint: String,
    pub expires_at_ms: u64,
}

impl LocalHubRuntime {
    /// Starts loopback HTTP or explicitly configured LAN HTTPS. LAN never falls back to HTTP.
    pub async fn start(
        config: TransportSecurityConfig,
        state: LocalHubState,
    ) -> Result<Self, RuntimeError> {
        state.runtime.write().await.state = HubLifecycleState::Starting;
        let address = config.bind_addr().map_err(RuntimeError::Binding)?;
        let (shutdown, shutdown_signal) = oneshot::channel();
        if config.binding == BindingMode::Loopback {
            let listener = tokio::net::TcpListener::bind(address)
                .await
                .map_err(RuntimeError::Io)?;
            let bound_address = listener.local_addr().map_err(RuntimeError::Io)?;
            {
                let mut runtime = state.runtime.write().await;
                runtime.state = HubLifecycleState::Running;
                runtime.binding = config.binding;
                runtime.address = Some(bound_address);
            }
            let server_state = state.clone();
            let task = tokio::spawn(async move {
                let result = axum::serve(listener, router(server_state.clone()))
                    .with_graceful_shutdown(async move {
                        let _ = shutdown_signal.await;
                    })
                    .await
                    .map_err(RuntimeError::Io);
                if result.is_err() {
                    let mut runtime = server_state.runtime.write().await;
                    runtime.state = HubLifecycleState::Failed;
                }
                result
            });
            return Ok(Self {
                config,
                state,
                shutdown: Some(shutdown),
                task: Some(task),
                tls_handle: None,
            });
        }

        let tls = config.server_config().map_err(RuntimeError::Tls)?;
        let std_listener = std::net::TcpListener::bind(address).map_err(RuntimeError::Io)?;
        std_listener
            .set_nonblocking(true)
            .map_err(RuntimeError::Io)?;
        let bound_address = std_listener.local_addr().map_err(RuntimeError::Io)?;
        let handle = axum_server::Handle::new();
        let server = axum_server::tls_rustls::from_tcp_rustls(
            std_listener,
            axum_server::tls_rustls::RustlsConfig::from_config(Arc::new(tls)),
        )
        .handle(handle.clone());
        {
            let mut runtime = state.runtime.write().await;
            runtime.state = HubLifecycleState::Running;
            runtime.binding = config.binding;
            runtime.address = Some(bound_address);
        }
        let server_state = state.clone();
        let shutdown_handle = handle.clone();
        let task = tokio::spawn(async move {
            let result = tokio::select! {
                result = server.serve(router(server_state.clone()).into_make_service()) => {
                    result.map_err(RuntimeError::Io)
                }
                _ = shutdown_signal => {
                    shutdown_handle.graceful_shutdown(Some(Duration::from_secs(1)));
                    Ok(())
                }
            };
            if result.is_err() {
                let mut runtime = server_state.runtime.write().await;
                runtime.state = HubLifecycleState::Failed;
            }
            result
        });
        Ok(Self {
            config,
            state,
            shutdown: Some(shutdown),
            task: Some(task),
            tls_handle: Some(handle),
        })
    }

    pub async fn status(&self) -> HubRuntimeStatus {
        self.state.runtime.read().await.clone()
    }

    /// Creates a short-lived, single-use invite. The code is returned only to the
    /// caller so it can be shown in the desktop pairing surface or encoded as QR.
    pub async fn create_pairing_invite(&self) -> Result<PairingInvite, RuntimeError> {
        if self.status().await.state != HubLifecycleState::Running {
            return Err(RuntimeError::NotRunning);
        }
        let mut grant_bytes = [0_u8; 16];
        let mut code_bytes = [0_u8; 18];
        getrandom::getrandom(&mut grant_bytes).map_err(RuntimeError::Random)?;
        getrandom::getrandom(&mut code_bytes).map_err(RuntimeError::Random)?;
        let grant_id = hex_bytes(&grant_bytes);
        let code = hex_bytes(&code_bytes);
        let expires_at_ms = now_ms().saturating_add(5 * 60 * 1_000);
        let host_fingerprint = self
            .config
            .host_fingerprint
            .clone()
            .unwrap_or_else(|| "loopback".to_owned());
        self.state.pairing.write().await.add_qr_grant(
            grant_id.clone(),
            &code,
            host_fingerprint.clone(),
            expires_at_ms,
        );
        let endpoint = self
            .state
            .app_url
            .clone()
            .ok_or(RuntimeError::MissingAppUrl)?;
        Ok(PairingInvite {
            endpoint,
            grant_id,
            code,
            host_fingerprint,
            expires_at_ms,
        })
    }

    pub async fn stop(&mut self) -> Result<(), RuntimeError> {
        if let Some(handle) = self.tls_handle.take() {
            handle.shutdown();
        }
        if let Some(shutdown) = self.shutdown.take() {
            self.state.runtime.write().await.state = HubLifecycleState::Stopping;
            let _ = shutdown.send(());
        }
        if let Some(task) = self.task.take() {
            match task.await {
                Ok(Ok(())) => {}
                Ok(Err(error)) => return Err(error),
                Err(_) => return Err(RuntimeError::TaskJoin),
            }
        }
        let mut runtime = self.state.runtime.write().await;
        runtime.state = HubLifecycleState::Stopped;
        runtime.address = None;
        Ok(())
    }

    pub async fn restart(self) -> Result<Self, RuntimeError> {
        let config = self.config.clone();
        let state = self.state.clone();
        let mut current = self;
        current.stop().await?;
        Self::start(config, state).await
    }
}

#[derive(Debug)]
pub enum RuntimeError {
    Binding(ConfigError),
    Tls(TlsConfigError),
    LanRequiresPairing,
    NotRunning,
    MissingAppUrl,
    Random(getrandom::Error),
    Io(std::io::Error),
    TaskJoin,
}

fn hex_bytes(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[derive(Clone, Copy, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum BindingMode {
    #[default]
    Loopback,
    Lan,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct LocalHubConfig {
    pub binding: BindingMode,
    pub port: u16,
}

impl Default for LocalHubConfig {
    fn default() -> Self {
        Self {
            binding: BindingMode::Loopback,
            port: DEFAULT_PORT,
        }
    }
}

impl LocalHubConfig {
    /// Returns the address that the transport may bind to for this config.
    /// The legacy contract remains loopback-only; LAN uses `TransportSecurityConfig`.
    pub fn bind_addr(&self) -> Result<SocketAddr, ConfigError> {
        match self.binding {
            BindingMode::Loopback => {
                Ok(SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), self.port))
            }
            BindingMode::Lan => Err(ConfigError::LanRequiresTlsAndPairing),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ConfigError {
    LanRequiresTlsAndPairing,
    LanAddressMustBeSpecific,
    TlsCertificateRequired,
    TlsPrivateKeyRequired,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TransportSecurityConfig {
    pub binding: BindingMode,
    pub address: IpAddr,
    pub port: u16,
    pub tls_certificate_pem: Option<String>,
    pub tls_private_key_pem: Option<String>,
    pub host_fingerprint: Option<String>,
}

impl Default for TransportSecurityConfig {
    fn default() -> Self {
        Self {
            binding: BindingMode::Loopback,
            address: IpAddr::V4(Ipv4Addr::LOCALHOST),
            port: DEFAULT_PORT,
            tls_certificate_pem: None,
            tls_private_key_pem: None,
            host_fingerprint: None,
        }
    }
}

impl TransportSecurityConfig {
    pub fn bind_addr(&self) -> Result<SocketAddr, ConfigError> {
        if self.binding == BindingMode::Loopback {
            return Ok(SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), self.port));
        }
        if self.address.is_unspecified() || self.address.is_loopback() {
            return Err(ConfigError::LanAddressMustBeSpecific);
        }
        if self
            .tls_certificate_pem
            .as_deref()
            .is_none_or(str::is_empty)
        {
            return Err(ConfigError::TlsCertificateRequired);
        }
        if self
            .tls_private_key_pem
            .as_deref()
            .is_none_or(str::is_empty)
        {
            return Err(ConfigError::TlsPrivateKeyRequired);
        }
        if self.host_fingerprint.as_deref().is_none_or(str::is_empty) {
            return Err(ConfigError::LanRequiresTlsAndPairing);
        }
        Ok(SocketAddr::new(self.address, self.port))
    }

    /// Parses the configured certificate and key into a rustls server config.
    /// The caller must still bind only to the address returned by `bind_addr`.
    pub fn server_config(&self) -> Result<rustls::ServerConfig, TlsConfigError> {
        let cert_pem = self
            .tls_certificate_pem
            .as_deref()
            .ok_or(TlsConfigError::CertificateRequired)?;
        let key_pem = self
            .tls_private_key_pem
            .as_deref()
            .ok_or(TlsConfigError::PrivateKeyRequired)?;
        let certificates = rustls_pemfile::certs(&mut Cursor::new(cert_pem.as_bytes()))
            .collect::<Result<Vec<_>, _>>()
            .map_err(|_| TlsConfigError::InvalidCertificate)?;
        if certificates.is_empty() {
            return Err(TlsConfigError::InvalidCertificate);
        }
        let key = rustls_pemfile::private_key(&mut Cursor::new(key_pem.as_bytes()))
            .map_err(|_| TlsConfigError::InvalidPrivateKey)?
            .ok_or(TlsConfigError::PrivateKeyRequired)?;
        rustls::ServerConfig::builder()
            .with_no_client_auth()
            .with_single_cert(certificates, key)
            .map_err(|_| TlsConfigError::InvalidCertificate)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TlsConfigError {
    CertificateRequired,
    PrivateKeyRequired,
    InvalidCertificate,
    InvalidPrivateKey,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DeviceIdentity {
    pub device_id: String,
    token_digest: [u8; 32],
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DiscoveryAdvertisement {
    pub service_name: String,
    pub service_type: String,
    pub host_fingerprint: String,
    pub port: u16,
    pub lan_enabled: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum NetworkAssessment {
    SameLocalNetwork,
    DifferentNetwork,
    LoopbackOnly,
    UnsupportedAddressFamily,
    InvalidPrefix,
}

/// Performs a deterministic preflight check for the LAN UX. This is only a
/// network hint: TLS, fingerprint and pairing remain mandatory afterwards.
pub fn assess_same_network(
    host_ip: IpAddr,
    client_ip: IpAddr,
    prefix_length: u8,
) -> NetworkAssessment {
    if host_ip.is_loopback() || client_ip.is_loopback() {
        return NetworkAssessment::LoopbackOnly;
    }
    match (host_ip, client_ip) {
        (IpAddr::V4(host), IpAddr::V4(client)) if prefix_length <= 32 => {
            let host = u32::from(host);
            let client = u32::from(client);
            let mask = if prefix_length == 0 {
                0
            } else {
                u32::MAX << (32 - prefix_length)
            };
            if host & mask == client & mask {
                NetworkAssessment::SameLocalNetwork
            } else {
                NetworkAssessment::DifferentNetwork
            }
        }
        (IpAddr::V6(host), IpAddr::V6(client)) if prefix_length <= 128 => {
            let host = host.octets();
            let client = client.octets();
            let full_bytes = usize::from(prefix_length / 8);
            let remainder = prefix_length % 8;
            let same_full = host[..full_bytes] == client[..full_bytes];
            let same_partial = remainder == 0
                || (host[full_bytes] >> (8 - remainder)) == (client[full_bytes] >> (8 - remainder));
            if same_full && same_partial {
                NetworkAssessment::SameLocalNetwork
            } else {
                NetworkAssessment::DifferentNetwork
            }
        }
        (IpAddr::V4(_), IpAddr::V4(_)) | (IpAddr::V6(_), IpAddr::V6(_)) => {
            NetworkAssessment::InvalidPrefix
        }
        _ => NetworkAssessment::UnsupportedAddressFamily,
    }
}

/// Publishes the Local Hub advertisement only after the caller has explicitly
/// enabled LAN mode and supplied a validated host identity.
pub fn publish_discovery(
    advertisement: &DiscoveryAdvertisement,
    host_ip: IpAddr,
    hostname: &str,
) -> Result<mdns_sd::ServiceDaemon, DiscoveryError> {
    if !advertisement.validate() {
        return Err(DiscoveryError::InvalidAdvertisement);
    }
    let daemon = mdns_sd::ServiceDaemon::new().map_err(|_| DiscoveryError::DaemonUnavailable)?;
    let properties = [("host-fingerprint", advertisement.host_fingerprint.as_str())];
    let service = mdns_sd::ServiceInfo::new(
        "_nexora._tcp.local.",
        &advertisement.service_name,
        &format!("{hostname}.local."),
        host_ip,
        advertisement.port,
        &properties[..],
    )
    .map_err(|_| DiscoveryError::InvalidAdvertisement)?;
    daemon
        .register(service)
        .map_err(|_| DiscoveryError::DaemonUnavailable)?;
    Ok(daemon)
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DiscoveryError {
    InvalidAdvertisement,
    DaemonUnavailable,
}

impl DiscoveryAdvertisement {
    pub fn validate(&self) -> bool {
        self.lan_enabled
            && self.service_type == "_nexora._tcp"
            && !self.service_name.is_empty()
            && !self.host_fingerprint.is_empty()
            && self.port != 0
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PairingError {
    InvalidCode,
    InvalidHostFingerprint,
    Expired,
    AlreadyUsed,
    Revoked,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AuthError {
    UnknownDevice,
    InvalidToken,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SessionError {
    NotConfigured,
    UnknownDevice,
    InvalidPasscode,
    RateLimited,
    InvalidSession,
    Expired,
}

#[derive(Clone, Debug)]
struct SessionRecord {
    device_id: String,
    token_digest: [u8; 32],
    expires_at_ms: u64,
}

/// In-memory passcode/session contract. Secrets are never retained in plaintext.
#[derive(Clone, Debug)]
pub struct PasscodeSessionRegistry {
    passcode_digest: Option<[u8; 32]>,
    passcode_salt: Vec<u8>,
    sessions: HashMap<String, SessionRecord>,
    failed_attempts: HashMap<String, (u32, u64)>,
    max_attempts: u32,
    window_ms: u64,
}

impl Default for PasscodeSessionRegistry {
    fn default() -> Self {
        Self {
            passcode_digest: None,
            passcode_salt: Vec::new(),
            sessions: HashMap::new(),
            failed_attempts: HashMap::new(),
            max_attempts: 5,
            window_ms: 60_000,
        }
    }
}

impl PasscodeSessionRegistry {
    pub fn is_configured(&self) -> bool {
        self.passcode_digest.is_some()
    }

    pub fn configure(
        &mut self,
        passcode: &str,
        salt: &[u8],
        max_attempts: u32,
        window_ms: u64,
    ) -> Result<(), SessionError> {
        if passcode.len() < 4 || salt.is_empty() || max_attempts == 0 || window_ms == 0 {
            return Err(SessionError::InvalidPasscode);
        }
        self.passcode_digest = Some(derive_passcode(passcode, salt));
        self.passcode_salt = salt.to_vec();
        self.max_attempts = max_attempts;
        self.window_ms = window_ms;
        self.sessions.clear();
        self.failed_attempts.clear();
        Ok(())
    }

    pub fn unlock(
        &mut self,
        device_id: &str,
        passcode: &str,
        session_token: &str,
        now_ms: u64,
        ttl_ms: u64,
    ) -> Result<(), SessionError> {
        let expected = self.passcode_digest.ok_or(SessionError::NotConfigured)?;
        let attempts = self
            .failed_attempts
            .entry(device_id.to_owned())
            .or_insert((0, now_ms));
        if now_ms.saturating_sub(attempts.1) >= self.window_ms {
            *attempts = (0, now_ms);
        }
        if attempts.0 >= self.max_attempts {
            return Err(SessionError::RateLimited);
        }
        if !constant_time_digest_eq(&expected, &derive_passcode(passcode, &self.passcode_salt)) {
            attempts.0 = attempts.0.saturating_add(1);
            return Err(SessionError::InvalidPasscode);
        }
        if session_token.len() < 24 || ttl_ms == 0 {
            return Err(SessionError::InvalidSession);
        }
        self.failed_attempts.remove(device_id);
        self.sessions.insert(
            session_token.to_owned(),
            SessionRecord {
                device_id: device_id.to_owned(),
                token_digest: digest(session_token),
                expires_at_ms: now_ms.saturating_add(ttl_ms),
            },
        );
        Ok(())
    }

    pub fn authenticate(
        &mut self,
        device_id: &str,
        session_token: &str,
        now_ms: u64,
    ) -> Result<(), SessionError> {
        let record = self
            .sessions
            .get(session_token)
            .ok_or(SessionError::InvalidSession)?;
        if record.device_id != device_id || record.token_digest != digest(session_token) {
            return Err(SessionError::InvalidSession);
        }
        if now_ms >= record.expires_at_ms {
            self.sessions.remove(session_token);
            return Err(SessionError::Expired);
        }
        Ok(())
    }

    pub fn logout(&mut self, session_token: &str) -> bool {
        self.sessions.remove(session_token).is_some()
    }

    pub fn revoke_device(&mut self, device_id: &str) {
        self.sessions
            .retain(|_, session| session.device_id != device_id);
        self.failed_attempts.remove(device_id);
    }
}

#[derive(Clone, Debug)]
struct PairingGrant {
    code_digest: [u8; 32],
    _host_fingerprint: String,
    expires_at_ms: u64,
    used: bool,
}

#[derive(Default)]
pub struct PairingRegistry {
    grants: HashMap<String, PairingGrant>,
    devices: HashMap<String, DeviceIdentity>,
}

impl PairingRegistry {
    pub fn add_qr_grant(
        &mut self,
        grant_id: impl Into<String>,
        code: &str,
        host_fingerprint: impl Into<String>,
        expires_at_ms: u64,
    ) {
        self.grants.insert(
            grant_id.into(),
            PairingGrant {
                code_digest: digest(code),
                _host_fingerprint: host_fingerprint.into(),
                expires_at_ms,
                used: false,
            },
        );
    }

    pub fn redeem(
        &mut self,
        grant_id: &str,
        code: &str,
        device_id: impl Into<String>,
        device_token: &str,
        host_fingerprint: &str,
        now_ms: u64,
    ) -> Result<(), PairingError> {
        let grant = self
            .grants
            .get_mut(grant_id)
            .ok_or(PairingError::InvalidCode)?;
        if grant.used {
            return Err(PairingError::AlreadyUsed);
        }
        if now_ms >= grant.expires_at_ms {
            return Err(PairingError::Expired);
        }
        if grant._host_fingerprint != host_fingerprint {
            return Err(PairingError::InvalidHostFingerprint);
        }
        if digest(code) != grant.code_digest {
            return Err(PairingError::InvalidCode);
        }
        grant.used = true;
        let device_id = device_id.into();
        self.devices.insert(
            device_id.clone(),
            DeviceIdentity::from_token(device_id, device_token),
        );
        Ok(())
    }

    pub fn revoke(&mut self, device_id: &str) -> bool {
        self.devices.remove(device_id).is_some()
    }

    pub fn is_paired(&self, device_id: &str) -> bool {
        self.devices.contains_key(device_id)
    }

    pub fn authorize(&self, device_id: &str, token: &str) -> Result<(), AuthError> {
        let identity = self
            .devices
            .get(device_id)
            .ok_or(AuthError::UnknownDevice)?;
        if identity.verifies(token) {
            Ok(())
        } else {
            Err(AuthError::InvalidToken)
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RateLimiter {
    limit: u32,
    window_ms: u64,
    buckets: HashMap<String, (u32, u64)>,
}

impl RateLimiter {
    pub fn new(limit: u32, window_ms: u64) -> Self {
        Self {
            limit,
            window_ms,
            buckets: HashMap::new(),
        }
    }

    pub fn allow(&mut self, device_id: &str, now_ms: u64) -> bool {
        let bucket = self
            .buckets
            .entry(device_id.to_owned())
            .or_insert((0, now_ms));
        if now_ms.saturating_sub(bucket.1) >= self.window_ms {
            *bucket = (0, now_ms);
        }
        bucket.0 = bucket.0.saturating_add(1);
        bucket.0 <= self.limit
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuditEvent {
    pub device_id: String,
    pub action: String,
    pub outcome: String,
}

impl AuditEvent {
    pub fn request(device_id: &str, action: &str, outcome: &str) -> Self {
        Self {
            device_id: device_id.to_owned(),
            action: action.to_owned(),
            outcome: outcome.to_owned(),
        }
    }
}

fn digest(value: &str) -> [u8; 32] {
    Sha256::digest(value.as_bytes()).into()
}

fn derive_passcode(passcode: &str, salt: &[u8]) -> [u8; 32] {
    let mut state = Sha256::new();
    state.update(salt);
    state.update(passcode.as_bytes());
    let mut derived: [u8; 32] = state.finalize().into();
    for _ in 0..100_000 {
        let mut round = Sha256::new();
        round.update(salt);
        round.update(derived);
        round.update(passcode.as_bytes());
        derived = round.finalize().into();
    }
    derived
}

fn constant_time_digest_eq(left: &[u8; 32], right: &[u8; 32]) -> bool {
    left.ct_eq(right).into()
}

impl DeviceIdentity {
    pub fn from_token(device_id: impl Into<String>, token: &str) -> Self {
        let mut digest = Sha256::new();
        digest.update(token.as_bytes());
        Self {
            device_id: device_id.into(),
            token_digest: digest.finalize().into(),
        }
    }

    pub fn verifies(&self, token: &str) -> bool {
        let mut digest = Sha256::new();
        digest.update(token.as_bytes());
        digest
            .finalize()
            .as_slice()
            .ct_eq(&self.token_digest)
            .into()
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct OperationEnvelope {
    pub idempotency_key: String,
    pub device_id: String,
    pub entity_id: String,
    pub base_revision: u64,
    pub payload_digest: String,
    pub created_at: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct ReplicableOperation {
    pub idempotency_key: String,
    pub device_id: String,
    pub entity_id: String,
    pub base_revision: u64,
    pub revision: u64,
    pub payload_digest: String,
    pub payload: String,
    pub tombstone: bool,
    pub created_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub enum OperationApplyResult {
    Applied { cursor: u64, revision: u64 },
    Duplicate { cursor: u64, revision: u64 },
    Conflict { current_revision: u64 },
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum ConflictPolicy {
    #[default]
    Manual,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ConflictRecord {
    pub entity_id: String,
    pub local_revision: u64,
    pub incoming_base_revision: u64,
    pub incoming_payload_digest: String,
}

impl ConflictRecord {
    pub fn requires_explicit_resolution(&self, policy: ConflictPolicy) -> bool {
        policy == ConflictPolicy::Manual
    }
}

#[derive(Default)]
pub struct AppendOnlyOperationLog {
    operations: Vec<ReplicableOperation>,
    idempotency: HashMap<String, (u64, u64)>,
    revisions: HashMap<String, u64>,
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct SyncCheckpoint {
    pub cursor: u64,
}

#[derive(Default)]
pub struct SyncTransport {
    pub log: AppendOnlyOperationLog,
    delivered_ids: HashSet<String>,
    checkpoint: SyncCheckpoint,
}

impl SyncTransport {
    pub fn push_authorized(
        &mut self,
        registry: &PairingRegistry,
        device_id: &str,
        token: &str,
        delivery_id: &str,
        operations: impl IntoIterator<Item = ReplicableOperation>,
    ) -> Result<Vec<OperationApplyResult>, TransportError> {
        registry
            .authorize(device_id, token)
            .map_err(|_| TransportError::UnauthorizedDevice)?;
        self.push(delivery_id, operations)
    }

    pub fn push(
        &mut self,
        delivery_id: &str,
        operations: impl IntoIterator<Item = ReplicableOperation>,
    ) -> Result<Vec<OperationApplyResult>, TransportError> {
        if !self.delivered_ids.insert(delivery_id.to_owned()) {
            return Err(TransportError::ReplayDetected);
        }
        Ok(operations
            .into_iter()
            .map(|operation| self.log.apply(operation))
            .collect())
    }

    pub fn pull(&self, after: u64) -> impl Iterator<Item = (u64, &ReplicableOperation)> {
        self.log.after(after)
    }

    pub fn acknowledge(&mut self, cursor: u64) -> Result<SyncCheckpoint, TransportError> {
        if cursor > self.log.operations.len() as u64 {
            return Err(TransportError::CursorAhead);
        }
        self.checkpoint = SyncCheckpoint { cursor };
        Ok(self.checkpoint)
    }

    pub fn checkpoint(&self) -> SyncCheckpoint {
        self.checkpoint
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TransportError {
    ReplayDetected,
    CursorAhead,
    UnauthorizedDevice,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueuedDelivery {
    pub delivery_id: String,
    pub operations: Vec<ReplicableOperation>,
    pub attempts: u32,
}

#[derive(Default)]
pub struct OfflineQueue {
    pending: VecDeque<QueuedDelivery>,
}

impl OfflineQueue {
    pub fn enqueue(
        &mut self,
        delivery_id: impl Into<String>,
        operations: Vec<ReplicableOperation>,
    ) {
        self.pending.push_back(QueuedDelivery {
            delivery_id: delivery_id.into(),
            operations,
            attempts: 0,
        });
    }

    pub fn next(&mut self, max_deliveries: usize) -> Vec<QueuedDelivery> {
        self.pending
            .iter_mut()
            .take(max_deliveries)
            .map(|delivery| {
                delivery.attempts = delivery.attempts.saturating_add(1);
                delivery.clone()
            })
            .collect()
    }

    pub fn acknowledge(&mut self, delivery_id: &str) -> bool {
        let before = self.pending.len();
        self.pending
            .retain(|delivery| delivery.delivery_id != delivery_id);
        before != self.pending.len()
    }

    pub fn pending_count(&self) -> usize {
        self.pending.len()
    }

    pub fn snapshot(&self) -> Vec<QueuedDelivery> {
        self.pending.iter().cloned().collect()
    }

    pub fn restore(&mut self, deliveries: Vec<QueuedDelivery>) {
        self.pending = deliveries.into_iter().collect();
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SyncRecoverySnapshot {
    pub checkpoint: SyncCheckpoint,
    pub pending_deliveries: Vec<QueuedDelivery>,
}

pub fn recover_sync_state(
    transport: &mut SyncTransport,
    queue: &mut OfflineQueue,
    snapshot: SyncRecoverySnapshot,
) -> Result<(), TransportError> {
    transport.acknowledge(snapshot.checkpoint.cursor)?;
    queue.restore(snapshot.pending_deliveries);
    Ok(())
}

pub fn reconcile_delivery(
    queue: &mut OfflineQueue,
    delivery: &QueuedDelivery,
    results: &[OperationApplyResult],
) -> bool {
    let complete = results.len() == delivery.operations.len()
        && results.iter().all(|result| {
            matches!(
                result,
                OperationApplyResult::Applied { .. } | OperationApplyResult::Duplicate { .. }
            )
        });
    if complete {
        queue.acknowledge(&delivery.delivery_id);
    }
    complete
}

impl AppendOnlyOperationLog {
    pub fn apply(&mut self, mut operation: ReplicableOperation) -> OperationApplyResult {
        if let Some((cursor, revision)) = self.idempotency.get(&operation.idempotency_key) {
            return OperationApplyResult::Duplicate {
                cursor: *cursor,
                revision: *revision,
            };
        }
        let current = self
            .revisions
            .get(&operation.entity_id)
            .copied()
            .unwrap_or(0);
        if operation.base_revision != current {
            return OperationApplyResult::Conflict {
                current_revision: current,
            };
        }
        let revision = current + 1;
        let cursor = self.operations.len() as u64 + 1;
        operation.revision = revision;
        self.revisions.insert(operation.entity_id.clone(), revision);
        self.idempotency
            .insert(operation.idempotency_key.clone(), (cursor, revision));
        self.operations.push(operation);
        OperationApplyResult::Applied { cursor, revision }
    }

    pub fn after(&self, cursor: u64) -> impl Iterator<Item = (u64, &ReplicableOperation)> {
        self.operations
            .iter()
            .enumerate()
            .skip(cursor as usize)
            .map(|(index, operation)| (index as u64 + 1, operation))
    }

    pub fn revision(&self, entity_id: &str) -> u64 {
        self.revisions.get(entity_id).copied().unwrap_or(0)
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct CursorQuery {
    pub after: u64,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct HealthResponse {
    pub api_version: u16,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub app_url: Option<String>,
    pub runtime_state: String,
    pub binding: BindingMode,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address: Option<SocketAddr>,
    pub sync_state: SyncRuntimeState,
    pub sync_cursor: u64,
}

pub fn health_response(app_url: Option<&str>) -> HealthResponse {
    health_response_with_runtime(app_url, &HubRuntimeStatus::default())
}

pub fn health_response_with_runtime(
    app_url: Option<&str>,
    runtime: &HubRuntimeStatus,
) -> HealthResponse {
    health_response_with_runtime_and_sync(app_url, runtime, &SyncRuntimeStatus::default())
}

pub fn health_response_with_runtime_and_sync(
    app_url: Option<&str>,
    runtime: &HubRuntimeStatus,
    sync: &SyncRuntimeStatus,
) -> HealthResponse {
    HealthResponse {
        api_version: API_VERSION,
        status: "ok".to_owned(),
        app_url: app_url.map(str::to_owned),
        runtime_state: runtime.state.as_str().to_owned(),
        binding: runtime.binding,
        address: runtime.address,
        sync_state: sync.state.clone(),
        sync_cursor: sync.cursor,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn passcode_sessions_are_expiring_rate_limited_and_revocable() {
        let mut registry = PasscodeSessionRegistry::default();
        registry.configure("4937", b"host-salt", 2, 1_000).unwrap();
        assert_eq!(
            registry.unlock("device-1", "0000", "session-token-000000000000", 10, 5_000),
            Err(SessionError::InvalidPasscode)
        );
        assert_eq!(
            registry.unlock("device-1", "0000", "session-token-000000000000", 11, 5_000),
            Err(SessionError::InvalidPasscode)
        );
        assert_eq!(
            registry.unlock("device-1", "4937", "session-token-000000000000", 12, 5_000),
            Err(SessionError::RateLimited)
        );
        assert_eq!(
            registry.unlock(
                "device-1",
                "4937",
                "session-token-000000000000",
                1_100,
                5_000
            ),
            Ok(())
        );
        assert_eq!(
            registry.authenticate("device-1", "session-token-000000000000", 1_101),
            Ok(())
        );
        assert_eq!(
            registry.authenticate("device-1", "session-token-000000000000", 6_101),
            Err(SessionError::Expired)
        );
        assert!(!registry.logout("session-token-000000000000"));
    }

    #[test]
    fn passcode_session_revocation_removes_device_sessions() {
        let mut registry = PasscodeSessionRegistry::default();
        registry.configure("4937", b"host-salt", 5, 1_000).unwrap();
        registry
            .unlock("device-1", "4937", "session-token-000000000000", 1, 5_000)
            .unwrap();
        registry.revoke_device("device-1");
        assert_eq!(
            registry.authenticate("device-1", "session-token-000000000000", 2),
            Err(SessionError::InvalidSession)
        );
    }
    use axum::body::{Body, to_bytes};
    use http::Request;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tower::ServiceExt;

    #[test]
    fn defaults_to_loopback_and_authoritative_port() {
        let config = LocalHubConfig::default();
        assert_eq!(
            config.bind_addr().unwrap(),
            SocketAddr::from(([127, 0, 0, 1], DEFAULT_PORT))
        );
    }

    #[test]
    fn lan_binding_cannot_be_enabled_before_security_gates() {
        let config = LocalHubConfig {
            binding: BindingMode::Lan,
            port: DEFAULT_PORT,
        };
        assert_eq!(
            config.bind_addr(),
            Err(ConfigError::LanRequiresTlsAndPairing)
        );
    }

    #[test]
    fn lan_binding_requires_specific_address_and_tls_material() {
        let config = TransportSecurityConfig {
            binding: BindingMode::Lan,
            address: "192.0.2.10".parse().unwrap(),
            port: DEFAULT_PORT,
            ..Default::default()
        };
        assert_eq!(config.bind_addr(), Err(ConfigError::TlsCertificateRequired));
    }

    #[test]
    fn device_identity_verifies_only_the_original_token() {
        let identity = DeviceIdentity::from_token("device-1", "synthetic-token");
        assert!(identity.verifies("synthetic-token"));
        assert!(!identity.verifies("wrong-token"));
    }

    #[test]
    fn discovery_advertisement_requires_explicit_lan_and_nexora_service() {
        let advertisement = DiscoveryAdvertisement {
            service_name: "nexora-host".to_owned(),
            service_type: "_nexora._tcp".to_owned(),
            host_fingerprint: "sha256:host".to_owned(),
            port: DEFAULT_PORT,
            lan_enabled: true,
        };
        assert!(advertisement.validate());
    }

    #[test]
    fn discovery_provider_rejects_unapproved_advertisement_before_starting_daemon() {
        let advertisement = DiscoveryAdvertisement {
            service_name: "nexora-host".to_owned(),
            service_type: "_http._tcp".to_owned(),
            host_fingerprint: "sha256:host".to_owned(),
            port: DEFAULT_PORT,
            lan_enabled: false,
        };
        assert!(matches!(
            publish_discovery(&advertisement, "192.0.2.10".parse().unwrap(), "nexora-host"),
            Err(DiscoveryError::InvalidAdvertisement)
        ));
    }

    #[test]
    fn network_assessment_is_only_a_hint_and_handles_lan_boundaries() {
        assert_eq!(
            assess_same_network(
                "192.168.1.20".parse().unwrap(),
                "192.168.1.42".parse().unwrap(),
                24
            ),
            NetworkAssessment::SameLocalNetwork
        );
        assert_eq!(
            assess_same_network(
                "192.168.1.20".parse().unwrap(),
                "192.168.2.42".parse().unwrap(),
                24
            ),
            NetworkAssessment::DifferentNetwork
        );
        assert_eq!(
            assess_same_network(
                "127.0.0.1".parse().unwrap(),
                "192.168.1.42".parse().unwrap(),
                24
            ),
            NetworkAssessment::LoopbackOnly
        );
        assert_eq!(
            assess_same_network(
                "192.168.1.20".parse().unwrap(),
                "192.168.1.42".parse().unwrap(),
                33
            ),
            NetworkAssessment::InvalidPrefix
        );
    }

    #[test]
    fn qr_pairing_is_expiring_single_use_and_revocable() {
        let mut registry = PairingRegistry::default();
        registry.add_qr_grant("grant-1", "one-time-code", "sha256:host", 2_000);
        assert_eq!(
            registry.redeem(
                "grant-1",
                "one-time-code",
                "phone-1",
                "device-token",
                "sha256:host",
                1_000
            ),
            Ok(())
        );
        assert_eq!(
            registry.redeem(
                "grant-1",
                "one-time-code",
                "phone-2",
                "device-token-2",
                "sha256:host",
                1_100
            ),
            Err(PairingError::AlreadyUsed)
        );
        assert!(registry.is_paired("phone-1"));
        assert!(registry.revoke("phone-1"));
        assert!(!registry.is_paired("phone-1"));
    }

    #[test]
    fn expired_qr_grant_cannot_pair() {
        let mut registry = PairingRegistry::default();
        registry.add_qr_grant("grant-1", "one-time-code", "sha256:host", 2_000);
        assert_eq!(
            registry.redeem(
                "grant-1",
                "one-time-code",
                "phone-1",
                "device-token",
                "sha256:host",
                2_000
            ),
            Err(PairingError::Expired)
        );
    }

    #[test]
    fn paired_device_authorization_rejects_unknown_and_wrong_tokens() {
        let mut registry = PairingRegistry::default();
        registry.add_qr_grant("grant-1", "one-time-code", "sha256:host", 2_000);
        registry
            .redeem(
                "grant-1",
                "one-time-code",
                "phone-1",
                "device-token",
                "sha256:host",
                1_000,
            )
            .unwrap();
        assert_eq!(
            registry.authorize("unknown", "one-time-code"),
            Err(AuthError::UnknownDevice)
        );
        assert_eq!(
            registry.authorize("phone-1", "wrong"),
            Err(AuthError::InvalidToken)
        );
        assert_eq!(registry.authorize("phone-1", "device-token"), Ok(()));
    }

    #[test]
    fn pairing_rejects_wrong_host_and_does_not_reuse_qr_code_as_device_token() {
        let mut registry = PairingRegistry::default();
        registry.add_qr_grant("grant-1", "one-time-code", "sha256:host", 2_000);
        assert_eq!(
            registry.redeem(
                "grant-1",
                "one-time-code",
                "phone-1",
                "device-token",
                "wrong-host",
                1_000
            ),
            Err(PairingError::InvalidHostFingerprint)
        );
        assert_eq!(
            registry.redeem(
                "grant-1",
                "one-time-code",
                "phone-1",
                "device-token",
                "sha256:host",
                1_000
            ),
            Ok(())
        );
        assert_eq!(
            registry.authorize("phone-1", "one-time-code"),
            Err(AuthError::InvalidToken)
        );
    }

    #[test]
    fn rate_limit_is_per_device_and_windowed() {
        let mut limiter = RateLimiter::new(2, 1_000);
        assert!(limiter.allow("phone-1", 0));
        assert!(limiter.allow("phone-1", 1));
        assert!(!limiter.allow("phone-1", 2));
        assert!(limiter.allow("phone-2", 2));
        assert!(limiter.allow("phone-1", 1_000));
    }

    #[test]
    fn audit_event_contains_metadata_but_no_secret() {
        let event = AuditEvent::request("phone-1", "pull", "denied");
        assert_eq!(event.outcome, "denied");
        assert!(!format!("{event:?}").contains("one-time-code"));
    }

    #[tokio::test]
    async fn runtime_health_is_public_but_authorized_route_is_fail_closed() {
        let app = router(LocalHubState::default());
        let health = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/v1/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(health.status(), StatusCode::OK);
        let unauthorized = app
            .oneshot(
                Request::builder()
                    .uri("/v1/authorize")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(unauthorized.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn pairing_endpoint_redeems_once_and_keeps_ledger_authorization_separate() {
        let state = LocalHubState::default();
        state.pairing.write().await.add_qr_grant(
            "grant-http",
            "synthetic-code",
            "sha256:host",
            now_ms() + 60_000,
        );
        let request = PairingRedeemRequest {
            grant_id: "grant-http".to_owned(),
            code: "synthetic-code".to_owned(),
            device_id: "browser-1".to_owned(),
            device_token: "synthetic-device-token-123456".to_owned(),
            host_fingerprint: "sha256:host".to_owned(),
        };
        let app = router(state.clone());
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/pairing/redeem")
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_vec(&request).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
        let replay = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/pairing/redeem")
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_vec(&request).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(replay.status(), StatusCode::GONE);
        assert_eq!(
            state
                .pairing
                .read()
                .await
                .authorize("browser-1", "synthetic-device-token-123456"),
            Ok(())
        );
    }

    #[tokio::test]
    async fn pairing_revoke_invalidates_target_device_and_session() {
        let state = LocalHubState::default();
        state.pairing.write().await.add_qr_grant(
            "grant-revoke",
            "code-revoke",
            "sha256:host",
            now_ms() + 60_000,
        );
        state
            .pairing
            .write()
            .await
            .redeem(
                "grant-revoke",
                "code-revoke",
                "browser-revoke",
                "device-token-revoke-123456",
                "sha256:host",
                now_ms(),
            )
            .unwrap();
        state
            .sessions
            .lock()
            .await
            .configure("4937", b"salt", 5, 60_000)
            .unwrap();
        state
            .sessions
            .lock()
            .await
            .unlock(
                "browser-revoke",
                "4937",
                "session-revoke-123456789",
                now_ms(),
                60_000,
            )
            .unwrap();
        let response = router(state.clone())
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/pairing/revoke")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        serde_json::to_vec(&PairingRevokeRequest {
                            requester_device_id: "browser-revoke".to_owned(),
                            requester_device_token: "device-token-revoke-123456".to_owned(),
                            target_device_id: "browser-revoke".to_owned(),
                        })
                        .unwrap(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
        assert_eq!(
            state
                .pairing
                .read()
                .await
                .authorize("browser-revoke", "device-token-revoke-123456"),
            Err(AuthError::UnknownDevice)
        );
        assert_eq!(
            state.sessions.lock().await.authenticate(
                "browser-revoke",
                "session-revoke-123456789",
                now_ms()
            ),
            Err(SessionError::InvalidSession)
        );
    }

    #[tokio::test]
    async fn browser_root_serves_the_real_app_shell_and_rejects_traversal() {
        let root = std::env::temp_dir().join(format!("nexora-local-hub-{}", now_ms()));
        tokio::fs::create_dir_all(&root).await.unwrap();
        tokio::fs::write(
            root.join("index.html"),
            "<!doctype html><html><body>Nexora desktop shell</body></html>",
        )
        .await
        .unwrap();
        let app = router(LocalHubState {
            app_url: Some("http://127.0.0.1:43173".to_owned()),
            browser_root: Some(root.clone()),
            ..LocalHubState::default()
        });
        let response = app
            .clone()
            .oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        assert!(
            String::from_utf8(body.to_vec())
                .unwrap()
                .contains("Nexora desktop shell")
        );
        let settings = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/settings")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(settings.status(), StatusCode::OK);
        assert_eq!(
            settings.headers().get(header::CONTENT_TYPE).unwrap(),
            "text/html; charset=utf-8"
        );
        let traversal = app
            .oneshot(
                Request::builder()
                    .uri("/../secret")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_ne!(traversal.status(), StatusCode::OK);
        let _ = tokio::fs::remove_dir_all(root).await;
    }

    #[tokio::test]
    async fn sync_http_requires_pairing_and_preserves_replay_and_cursor_contracts() {
        let directory = tempfile::tempdir().unwrap();
        let mut state = LocalHubState::default();
        state.durable_sync = Some(Arc::new(Mutex::new(
            SqliteSyncOperationStore::open(directory.path().join("nexora.db")).unwrap(),
        )));
        let token = "synthetic-sync-device-token-123456";
        state.pairing.write().await.add_qr_grant(
            "grant-sync",
            "code-sync",
            "sha256:host",
            now_ms() + 60_000,
        );
        state
            .pairing
            .write()
            .await
            .redeem(
                "grant-sync",
                "code-sync",
                "browser-sync",
                token,
                "sha256:host",
                now_ms(),
            )
            .unwrap();
        let operation = ReplicableOperation {
            idempotency_key: "op-http-1".to_owned(),
            device_id: "browser-sync".to_owned(),
            entity_id: "movement-http-1".to_owned(),
            base_revision: 0,
            revision: 0,
            payload_digest: "sha256:payload".to_owned(),
            payload: "{\"schema_version\":1,\"operation\":\"upsert\",\"entity_type\":\"transaction\",\"entity_id\":\"movement-http-1\",\"amount_minor\":\"100\",\"currency\":\"EUR\"}".to_owned(),
            tombstone: false,
            created_at: "2026-09-12T00:00:00Z".to_owned(),
        };
        let headers = |request: http::request::Builder| {
            request
                .header("authorization", format!("Bearer {token}"))
                .header("x-nexora-device-id", "browser-sync")
                .header("content-type", "application/json")
        };
        let app = router(state);
        let push = app
            .clone()
            .oneshot(
                headers(Request::builder().method("POST").uri("/v1/operations"))
                    .body(Body::from(
                        serde_json::to_vec(&PushOperationsRequest {
                            delivery_id: "delivery-http-1".to_owned(),
                            operations: vec![operation.clone()],
                        })
                        .unwrap(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(push.status(), StatusCode::OK);
        let replay = app
            .clone()
            .oneshot(
                headers(Request::builder().method("POST").uri("/v1/operations"))
                    .body(Body::from(
                        serde_json::to_vec(&PushOperationsRequest {
                            delivery_id: "delivery-http-1".to_owned(),
                            operations: vec![operation],
                        })
                        .unwrap(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(replay.status(), StatusCode::CONFLICT);
        let pull = app
            .clone()
            .oneshot(
                headers(
                    Request::builder()
                        .method("GET")
                        .uri("/v1/operations?after=0"),
                )
                .body(Body::empty())
                .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(pull.status(), StatusCode::OK);
        let body = to_bytes(pull.into_body(), usize::MAX).await.unwrap();
        let response: PullOperationsResponse = serde_json::from_slice(&body).unwrap();
        assert_eq!(response.operations.len(), 1);
        assert_eq!(response.operations[0].0, 1);
        let bootstrap = app
            .oneshot(
                headers(Request::builder().method("GET").uri("/v1/bootstrap"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(bootstrap.status(), StatusCode::OK);
        let body = to_bytes(bootstrap.into_body(), usize::MAX).await.unwrap();
        let snapshot: SyncBootstrapSnapshot = serde_json::from_slice(&body).unwrap();
        assert_eq!(snapshot.schema_version, 1);
        assert_eq!(snapshot.cursor, 1);
        assert_eq!(snapshot.operations.len(), 1);
    }

    #[tokio::test]
    async fn configured_session_is_required_for_sync_and_can_be_unlocked_and_logged_out() {
        let state = LocalHubState::default();
        let token = "synthetic-session-device-token-123456";
        state.pairing.write().await.add_qr_grant(
            "grant-session",
            "code-session",
            "sha256:host",
            now_ms() + 60_000,
        );
        state
            .pairing
            .write()
            .await
            .redeem(
                "grant-session",
                "code-session",
                "browser-session",
                token,
                "sha256:host",
                now_ms(),
            )
            .unwrap();
        let app = router(state.clone());
        let configure = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/session/configure")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        serde_json::to_vec(&SessionConfigureRequest {
                            device_id: "browser-session".to_owned(),
                            device_token: token.to_owned(),
                            passcode: "4937".to_owned(),
                            salt: b"synthetic-salt".to_vec(),
                        })
                        .unwrap(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(configure.status(), StatusCode::OK);

        let unauthorized = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/v1/operations?after=0")
                    .header("authorization", format!("Bearer {token}"))
                    .header("x-nexora-device-id", "browser-session")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(unauthorized.status(), StatusCode::UNAUTHORIZED);

        let unlock = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/session/unlock")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        serde_json::to_vec(&SessionUnlockRequest {
                            device_id: "browser-session".to_owned(),
                            device_token: token.to_owned(),
                            passcode: "4937".to_owned(),
                            session_token: "synthetic-session-token-123456".to_owned(),
                            now_ms: 0,
                            ttl_ms: 60_000,
                        })
                        .unwrap(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(unlock.status(), StatusCode::OK);

        let authorized = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/v1/operations?after=0")
                    .header("authorization", format!("Bearer {token}"))
                    .header("x-nexora-device-id", "browser-session")
                    .header("x-nexora-session-token", "synthetic-session-token-123456")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(authorized.status(), StatusCode::OK);

        let logout = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/session/logout")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        serde_json::to_vec(&SessionLogoutRequest {
                            device_id: "browser-session".to_owned(),
                            session_token: "synthetic-session-token-123456".to_owned(),
                            now_ms: 0,
                        })
                        .unwrap(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(logout.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn health_advertises_only_the_explicit_browser_entry_point() {
        let app = router(LocalHubState {
            app_url: Some("https://nexora.home".to_owned()),
            ..LocalHubState::default()
        });
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v1/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let health: HealthResponse = serde_json::from_slice(&body).unwrap();
        assert_eq!(health.app_url.as_deref(), Some("https://nexora.home"));
    }

    #[tokio::test]
    async fn lifecycle_starts_on_loopback_reports_status_and_stops_cleanly() {
        let state = LocalHubState::default();
        let config = TransportSecurityConfig {
            port: 0,
            ..TransportSecurityConfig::default()
        };
        let mut runtime = LocalHubRuntime::start(config, state.clone()).await.unwrap();
        let status = runtime.status().await;
        assert_eq!(status.state, HubLifecycleState::Running);
        assert_eq!(status.binding, BindingMode::Loopback);
        let address = status.address.unwrap();
        let health = loopback_health(address).await;
        assert!(health.starts_with("HTTP/1.1 200 OK"));
        assert!(health.contains("\"runtime_state\":\"running\""));
        runtime.stop().await.unwrap();
        assert_eq!(runtime.status().await.state, HubLifecycleState::Stopped);
    }

    #[tokio::test]
    async fn running_runtime_creates_single_use_pairing_invite_without_plaintext_storage() {
        let state = LocalHubState {
            app_url: Some("http://127.0.0.1:43173".to_owned()),
            ..LocalHubState::default()
        };
        let config = TransportSecurityConfig {
            port: 0,
            ..TransportSecurityConfig::default()
        };
        let mut runtime = LocalHubRuntime::start(config, state.clone()).await.unwrap();
        let invite = runtime.create_pairing_invite().await.unwrap();
        assert_eq!(invite.endpoint, "http://127.0.0.1:43173");
        assert_eq!(invite.grant_id.len(), 32);
        assert_eq!(invite.code.len(), 36);
        assert_eq!(invite.host_fingerprint, "loopback");
        state
            .pairing
            .write()
            .await
            .redeem(
                &invite.grant_id,
                &invite.code,
                "synthetic-phone",
                "synthetic-device-token-123456",
                &invite.host_fingerprint,
                invite.expires_at_ms.saturating_sub(1),
            )
            .unwrap();
        assert!(
            state
                .pairing
                .read()
                .await
                .authorize("synthetic-phone", "synthetic-device-token-123456")
                .is_ok()
        );
        runtime.stop().await.unwrap();
    }

    #[tokio::test]
    async fn lifecycle_rejects_lan_without_explicit_tls_material() {
        let config = TransportSecurityConfig {
            binding: BindingMode::Lan,
            address: "192.0.2.10".parse().unwrap(),
            ..TransportSecurityConfig::default()
        };
        assert!(matches!(
            LocalHubRuntime::start(config, LocalHubState::default()).await,
            Err(RuntimeError::Binding(ConfigError::TlsCertificateRequired))
        ));
    }

    async fn loopback_health(address: SocketAddr) -> String {
        let mut stream = tokio::net::TcpStream::connect(address).await.unwrap();
        stream
            .write_all(b"GET /v1/health HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n")
            .await
            .unwrap();
        let mut response = Vec::new();
        stream.read_to_end(&mut response).await.unwrap();
        String::from_utf8(response).unwrap()
    }

    #[test]
    fn operation_contract_round_trips_without_database_payload() {
        let operation = OperationEnvelope {
            idempotency_key: "op-1".to_owned(),
            device_id: "device-1".to_owned(),
            entity_id: "movement-1".to_owned(),
            base_revision: 7,
            payload_digest: "sha256:example".to_owned(),
            created_at: "2026-09-07T20:00:00Z".to_owned(),
        };
        let json = serde_json::to_string(&operation).unwrap();
        assert!(!json.contains("sqlite"));
        assert_eq!(
            serde_json::from_str::<OperationEnvelope>(&json).unwrap(),
            operation
        );
    }

    #[test]
    fn append_only_log_assigns_revision_and_cursor_without_overwriting() {
        let mut log = AppendOnlyOperationLog::default();
        let operation = ReplicableOperation {
            idempotency_key: "op-1".to_owned(),
            device_id: "phone-1".to_owned(),
            entity_id: "movement-1".to_owned(),
            base_revision: 0,
            revision: 0,
            payload_digest: "sha256:payload".to_owned(),
            payload: "{\"amountMinor\":100}".to_owned(),
            tombstone: false,
            created_at: "2026-09-08T00:00:00Z".to_owned(),
        };
        assert_eq!(
            log.apply(operation.clone()),
            OperationApplyResult::Applied {
                cursor: 1,
                revision: 1
            }
        );
        assert_eq!(
            log.apply(operation),
            OperationApplyResult::Duplicate {
                cursor: 1,
                revision: 1
            }
        );
        assert_eq!(log.revision("movement-1"), 1);
        assert_eq!(log.after(0).count(), 1);
    }

    #[test]
    fn append_only_log_keeps_tombstones_and_rejects_stale_revisions() {
        let mut log = AppendOnlyOperationLog::default();
        let tombstone = ReplicableOperation {
            idempotency_key: "delete-1".to_owned(),
            device_id: "phone-1".to_owned(),
            entity_id: "movement-1".to_owned(),
            base_revision: 0,
            revision: 0,
            payload_digest: "sha256:empty".to_owned(),
            payload: "{}".to_owned(),
            tombstone: true,
            created_at: "2026-09-08T00:00:00Z".to_owned(),
        };
        assert!(matches!(
            log.apply(tombstone),
            OperationApplyResult::Applied { .. }
        ));
        let stale = ReplicableOperation {
            idempotency_key: "stale-1".to_owned(),
            device_id: "phone-2".to_owned(),
            entity_id: "movement-1".to_owned(),
            base_revision: 0,
            revision: 0,
            payload_digest: "sha256:other".to_owned(),
            payload: "{}".to_owned(),
            tombstone: false,
            created_at: "2026-09-08T00:00:01Z".to_owned(),
        };
        assert_eq!(
            log.apply(stale),
            OperationApplyResult::Conflict {
                current_revision: 1
            }
        );
        assert!(log.after(0).next().unwrap().1.tombstone);
    }

    #[test]
    fn sync_transport_rejects_duplicate_delivery_and_advances_checkpoint() {
        let mut transport = SyncTransport::default();
        let operation = ReplicableOperation {
            idempotency_key: "op-transport-1".to_owned(),
            device_id: "phone-1".to_owned(),
            entity_id: "movement-1".to_owned(),
            base_revision: 0,
            revision: 0,
            payload_digest: "sha256:payload".to_owned(),
            payload: "{\"amountMinor\":200}".to_owned(),
            tombstone: false,
            created_at: "2026-09-08T00:00:00Z".to_owned(),
        };
        assert!(matches!(
            transport.push("delivery-1", vec![operation]),
            Ok(results) if results == vec![OperationApplyResult::Applied { cursor: 1, revision: 1 }]
        ));
        assert_eq!(
            transport.push("delivery-1", Vec::new()),
            Err(TransportError::ReplayDetected)
        );
        assert_eq!(transport.acknowledge(1), Ok(SyncCheckpoint { cursor: 1 }));
        assert_eq!(transport.checkpoint(), SyncCheckpoint { cursor: 1 });
        assert_eq!(transport.acknowledge(2), Err(TransportError::CursorAhead));
    }

    #[test]
    fn offline_queue_retries_partial_delivery_without_dropping_operations() {
        let operation = ReplicableOperation {
            idempotency_key: "op-queue-1".to_owned(),
            device_id: "phone-1".to_owned(),
            entity_id: "movement-1".to_owned(),
            base_revision: 0,
            revision: 0,
            payload_digest: "sha256:payload".to_owned(),
            payload: "{\"amountMinor\":300}".to_owned(),
            tombstone: false,
            created_at: "2026-09-08T00:00:00Z".to_owned(),
        };
        let mut queue = OfflineQueue::default();
        queue.enqueue("delivery-queue-1", vec![operation]);
        let first = queue.next(1).pop().unwrap();
        assert_eq!(first.attempts, 1);
        assert!(!reconcile_delivery(&mut queue, &first, &[]));
        assert_eq!(queue.pending_count(), 1);
        let retry = queue.next(1).pop().unwrap();
        assert_eq!(retry.attempts, 2);
        assert!(reconcile_delivery(
            &mut queue,
            &retry,
            &[OperationApplyResult::Applied {
                cursor: 1,
                revision: 1
            }]
        ));
        assert_eq!(queue.pending_count(), 0);
    }

    #[test]
    fn conflicts_use_manual_policy_and_cannot_be_auto_resolved() {
        let conflict = ConflictRecord {
            entity_id: "movement-1".to_owned(),
            local_revision: 3,
            incoming_base_revision: 2,
            incoming_payload_digest: "sha256:incoming".to_owned(),
        };
        assert!(conflict.requires_explicit_resolution(ConflictPolicy::Manual));
    }

    #[test]
    fn reconciliation_accepts_duplicate_delivery_results_but_not_conflicts() {
        let mut queue = OfflineQueue::default();
        let operation = ReplicableOperation {
            idempotency_key: "op-queue-2".to_owned(),
            device_id: "phone-1".to_owned(),
            entity_id: "movement-2".to_owned(),
            base_revision: 0,
            revision: 0,
            payload_digest: "sha256:payload".to_owned(),
            payload: "{}".to_owned(),
            tombstone: false,
            created_at: "2026-09-08T00:00:00Z".to_owned(),
        };
        queue.enqueue("delivery-queue-2", vec![operation]);
        let delivery = queue.next(1).pop().unwrap();
        assert!(!reconcile_delivery(
            &mut queue,
            &delivery,
            &[OperationApplyResult::Conflict {
                current_revision: 1
            }]
        ));
        assert!(reconcile_delivery(
            &mut queue,
            &delivery,
            &[OperationApplyResult::Duplicate {
                cursor: 1,
                revision: 1
            }]
        ));
        assert_eq!(queue.pending_count(), 0);
    }

    #[test]
    fn recovery_restores_checkpoint_and_pending_delivery_without_data_loss() {
        let mut transport = SyncTransport::default();
        let mut queue = OfflineQueue::default();
        queue.enqueue("recovery-delivery", Vec::new());
        let snapshot = SyncRecoverySnapshot {
            checkpoint: SyncCheckpoint { cursor: 0 },
            pending_deliveries: queue.snapshot(),
        };
        let mut recovered_queue = OfflineQueue::default();
        recover_sync_state(&mut transport, &mut recovered_queue, snapshot).unwrap();
        assert_eq!(transport.checkpoint(), SyncCheckpoint { cursor: 0 });
        assert_eq!(recovered_queue.pending_count(), 1);
    }

    #[test]
    fn revoked_device_cannot_push_and_second_device_conflict_is_explicit() {
        let mut registry = PairingRegistry::default();
        registry.add_qr_grant("grant-a", "code-a", "sha256:host", 2_000);
        registry
            .redeem(
                "grant-a",
                "code-a",
                "phone-a",
                "token-a",
                "sha256:host",
                1_000,
            )
            .unwrap();
        registry.add_qr_grant("grant-b", "code-b", "sha256:host", 2_000);
        registry
            .redeem(
                "grant-b",
                "code-b",
                "phone-b",
                "token-b",
                "sha256:host",
                1_000,
            )
            .unwrap();
        let operation = |device_id: &str, key: &str| ReplicableOperation {
            idempotency_key: key.to_owned(),
            device_id: device_id.to_owned(),
            entity_id: "movement-shared".to_owned(),
            base_revision: 0,
            revision: 0,
            payload_digest: format!("sha256:{key}"),
            payload: "{\"amountMinor\":100}".to_owned(),
            tombstone: false,
            created_at: "2026-09-08T00:00:00Z".to_owned(),
        };
        let mut transport = SyncTransport::default();
        assert!(matches!(
            transport.push_authorized(&registry, "phone-a", "token-a", "delivery-a", [operation("phone-a", "op-a")]),
            Ok(results) if results == vec![OperationApplyResult::Applied { cursor: 1, revision: 1 }]
        ));
        assert_eq!(
            transport.push_authorized(
                &registry,
                "phone-b",
                "token-b",
                "delivery-b",
                [operation("phone-b", "op-b")]
            ),
            Ok(vec![OperationApplyResult::Conflict {
                current_revision: 1
            }])
        );
        registry.revoke("phone-a");
        assert_eq!(
            transport.push_authorized(&registry, "phone-a", "token-a", "delivery-revoked", []),
            Err(TransportError::UnauthorizedDevice)
        );
    }
}
