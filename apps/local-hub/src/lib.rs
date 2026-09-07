//! Contract foundation for the Nexora Local Hub.
//!
//! The service is intentionally not started by this crate yet.  This slice fixes
//! the safe binding defaults and the wire-level operation metadata so later
//! transport work cannot accidentally expose a database or an unauthenticated LAN port.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::Cursor;
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
        digest.finalize().as_slice() == self.token_digest
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
}
