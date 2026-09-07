//! Contract foundation for the Nexora Local Hub.
//!
//! The service runtime is deliberately fail-closed: loopback is the default and
//! LAN publication requires validated TLS, identity, pairing and authorization.

use axum::{
    Json, Router,
    extract::State,
    http::{HeaderMap, StatusCode, header},
    response::IntoResponse,
    routing::get,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet, VecDeque};
use std::io::Cursor;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::Arc;
use subtle::ConstantTimeEq;
use tokio::sync::{Mutex, RwLock};

pub const API_VERSION: u16 = 1;
pub const DEFAULT_PORT: u16 = 43_173;

#[derive(Clone)]
pub struct LocalHubState {
    pub pairing: Arc<RwLock<PairingRegistry>>,
    pub rate_limiter: Arc<Mutex<RateLimiter>>,
}

impl Default for LocalHubState {
    fn default() -> Self {
        Self {
            pairing: Arc::new(RwLock::new(PairingRegistry::default())),
            rate_limiter: Arc::new(Mutex::new(RateLimiter::new(60, 60_000))),
        }
    }
}

pub fn router(state: LocalHubState) -> Router {
    Router::new()
        .route("/v1/health", get(health))
        .route("/v1/authorize", get(authorize))
        .with_state(state)
}

async fn health() -> impl IntoResponse {
    (StatusCode::OK, Json(health_response()))
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

#[derive(Debug)]
pub enum RuntimeError {
    Binding(ConfigError),
    Tls(TlsConfigError),
    Io(std::io::Error),
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

#[derive(Clone, Debug, Eq, PartialEq)]
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
}

pub fn health_response() -> HealthResponse {
    HealthResponse {
        api_version: API_VERSION,
        status: "ok".to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use http::Request;
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
