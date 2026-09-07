//! Contract foundation for the Nexora Local Hub.
//!
//! The service is intentionally not started by this crate yet.  This slice fixes
//! the safe binding defaults and the wire-level operation metadata so later
//! transport work cannot accidentally expose a database or an unauthenticated LAN port.

use serde::{Deserialize, Serialize};
use std::net::{IpAddr, Ipv4Addr, SocketAddr};

pub const API_VERSION: u16 = 1;
pub const DEFAULT_PORT: u16 = 43_173;

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
    /// LAN binding is rejected until the TLS/pairing gate is implemented.
    pub fn bind_addr(&self) -> Result<SocketAddr, ConfigError> {
        match self.binding {
            BindingMode::Loopback => Ok(SocketAddr::new(
                IpAddr::V4(Ipv4Addr::LOCALHOST),
                self.port,
            )),
            BindingMode::Lan => Err(ConfigError::LanRequiresTlsAndPairing),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ConfigError {
    LanRequiresTlsAndPairing,
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

    #[test]
    fn defaults_to_loopback_and_authoritative_port() {
        let config = LocalHubConfig::default();
        assert_eq!(config.bind_addr().unwrap(), SocketAddr::from(([127, 0, 0, 1], DEFAULT_PORT)));
    }

    #[test]
    fn lan_binding_cannot_be_enabled_before_security_gates() {
        let config = LocalHubConfig { binding: BindingMode::Lan, port: DEFAULT_PORT };
        assert_eq!(config.bind_addr(), Err(ConfigError::LanRequiresTlsAndPairing));
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
        assert_eq!(serde_json::from_str::<OperationEnvelope>(&json).unwrap(), operation);
    }
}
