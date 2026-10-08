use std::collections::HashMap;
use std::fs;
use std::net::{IpAddr, UdpSocket};
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};

use nexora_local_hub::{
    HubRuntimeStatus, LocalHubRuntime, LocalHubState, PairingInvite, SqliteSyncOperationStore,
    TransportSecurityConfig,
};
use rusqlite::{Connection, params_from_iter, types::Value};
use serde_json::{Map, Value as JsonValue};
use sha2::{Digest, Sha256};
use tauri::{Manager, State};
use tokio::sync::Mutex as AsyncMutex;

#[cfg(mobile)]
use tauri_plugin_keystore::{KeystoreExt, RetrieveRequest, StoreRequest};

#[derive(Default)]
struct NativeTransactionState {
    next_id: AtomicU64,
    connections: Mutex<HashMap<String, Connection>>,
}

#[derive(Default)]
struct LocalHubNativeState {
    runtime: AsyncMutex<Option<LocalHubRuntime>>,
}

#[derive(Clone, Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativeHttpRequest {
    url: String,
    method: String,
    headers: HashMap<String, String>,
    body: Option<String>,
    certificate_pem: Option<String>,
    expected_fingerprint: Option<String>,
    host_identity: Option<String>,
    resolve_address: Option<String>,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeHttpResponse {
    status: u16,
    headers: HashMap<String, String>,
    body: String,
}

#[tauri::command]
async fn local_host_request(request: NativeHttpRequest) -> Result<NativeHttpResponse, String> {
    if request.url.starts_with("https://") && request.certificate_pem.is_none() {
        return Err("pinned_host_certificate_required".to_owned());
    }
    let mut builder = reqwest::Client::builder()
        .https_only(request.url.starts_with("https://"))
        .redirect(reqwest::redirect::Policy::none());
    if let (Some(host_identity), Some(resolve_address)) = (
        request.host_identity.as_deref(),
        request.resolve_address.as_deref(),
    ) {
        let address = resolve_address
            .parse::<std::net::SocketAddr>()
            .map_err(|_| "invalid_host_resolution_address".to_owned())?;
        builder = builder.resolve(host_identity, address);
    }
    if let Some(certificate_pem) = request.certificate_pem.as_deref() {
        if let Some(expected) = request.expected_fingerprint.as_deref() {
            let mut reader = std::io::Cursor::new(certificate_pem.as_bytes());
            let certificate = rustls_pemfile::certs(&mut reader)
                .next()
                .ok_or_else(|| "invalid_pinned_host_certificate".to_owned())
                .and_then(|result| {
                    result.map_err(|_| "invalid_pinned_host_certificate".to_owned())
                })?;
            verify_certificate_fingerprint(certificate.as_ref(), expected)?;
        }
        let certificate = reqwest::Certificate::from_pem(certificate_pem.as_bytes())
            .map_err(|_| "invalid_pinned_host_certificate".to_owned())?;
        builder = builder
            .tls_built_in_root_certs(false)
            .add_root_certificate(certificate);
    }
    let client = builder
        .build()
        .map_err(|error| format!("native_http_client_failed: {error}"))?;
    let method = reqwest::Method::from_bytes(request.method.as_bytes())
        .map_err(|_| "invalid_http_method".to_owned())?;
    let mut outgoing = client.request(method, &request.url);
    for (name, value) in request.headers {
        outgoing = outgoing.header(name, value);
    }
    if let Some(body) = request.body {
        outgoing = outgoing.body(body);
    }
    let response = outgoing
        .send()
        .await
        .map_err(|error| format!("native_http_request_failed: {error}"))?;
    let status = response.status().as_u16();
    let headers = response
        .headers()
        .iter()
        .filter_map(|(name, value)| Some((name.to_string(), value.to_str().ok()?.to_owned())))
        .collect();
    let body = response
        .text()
        .await
        .map_err(|error| format!("native_http_response_failed: {error}"))?;
    Ok(NativeHttpResponse {
        status,
        headers,
        body,
    })
}

fn verify_certificate_fingerprint(certificate_der: &[u8], expected: &str) -> Result<(), String> {
    let actual = format!(
        "sha256:{}",
        Sha256::digest(certificate_der)
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>()
    );
    if actual == expected {
        Ok(())
    } else {
        Err("host_fingerprint_mismatch".to_owned())
    }
}

#[derive(Clone, Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct LanHubStartRequest {
    address: String,
    certificate_path: String,
    private_key_path: String,
}

#[tauri::command]
async fn pc_manager_start(
    app: tauri::AppHandle,
    state: State<'_, LocalHubNativeState>,
) -> Result<HubRuntimeStatus, String> {
    let mut runtime = state.runtime.lock().await;
    if let Some(current) = runtime.as_ref() {
        return Ok(current.status().await);
    }
    let mut hub_state = LocalHubState::default();
    hub_state.app_url = Some("http://127.0.0.1:43173".to_owned());
    hub_state.browser_root = app
        .path()
        .resource_dir()
        .ok()
        .map(|directory| directory.join("browser"));
    let started = LocalHubRuntime::start(TransportSecurityConfig::default(), hub_state)
        .await
        .map_err(|error| format!("Local Hub start failed: {error:?}"))?;
    let status = started.status().await;
    *runtime = Some(started);
    Ok(status)
}

/// Starts the phone-owned host while Nexora is in the Android foreground.
/// PMA-1 intentionally keeps this command loopback-only; LAN/TLS provisioning
/// is a later gate and cannot be inferred from the phone being on Wi-Fi.
#[tauri::command]
async fn phone_local_hub_start(
    app: tauri::AppHandle,
    state: State<'_, LocalHubNativeState>,
) -> Result<HubRuntimeStatus, String> {
    let mut runtime = state.runtime.lock().await;
    if let Some(current) = runtime.as_ref() {
        return Ok(current.status().await);
    }
    let mut hub_state = LocalHubState::default();
    let database_file = database_path(&app, "sqlite:nexora.db")?;
    hub_state.durable_sync = Some(Arc::new(AsyncMutex::new(
        SqliteSyncOperationStore::open(database_file)
            .map_err(|error| format!("Phone Local Hub SQLite sync store failed: {error}"))?,
    )));
    let lan_address = detect_local_lan_address()?;
    let identity = load_or_generate_phone_lan_identity(&app, lan_address).await?;
    hub_state.app_url = Some(format!("https://{lan_address}:43173/"));
    hub_state.browser_root = app
        .path()
        .resource_dir()
        .ok()
        .map(|directory| directory.join("browser"));
    let config = TransportSecurityConfig {
        binding: nexora_local_hub::BindingMode::Lan,
        address: lan_address,
        port: 43_173,
        tls_certificate_pem: Some(identity.certificate_pem),
        tls_private_key_pem: Some(identity.private_key_pem),
        host_fingerprint: Some(identity.fingerprint),
        host_identity: Some(identity.host_identity),
    };
    let started = LocalHubRuntime::start(config, hub_state)
        .await
        .map_err(|error| format!("Phone Local Hub start failed: {error:?}"))?;
    let status = started.status().await;
    *runtime = Some(started);
    Ok(status)
}

struct PhoneLanIdentity {
    certificate_pem: String,
    private_key_pem: String,
    fingerprint: String,
    host_identity: String,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
struct PersistedPhoneLanIdentity {
    certificate_pem: String,
    fingerprint: String,
    key_alias: String,
    host_identity: String,
}

#[cfg(mobile)]
async fn load_or_generate_phone_lan_identity(
    app: &tauri::AppHandle,
    address: IpAddr,
) -> Result<PhoneLanIdentity, String> {
    let path = database_path(app, "phone-local-hub-identity.json")?;
    let key_alias = "nexora.local-hub.tls.v1".to_owned();
    if let Ok(raw) = fs::read_to_string(&path) {
        if let Ok(identity) = serde_json::from_str::<PersistedPhoneLanIdentity>(&raw) {
            if identity.key_alias != key_alias {
                return Err("invalid_persisted_local_hub_identity".to_owned());
            }
            let private_key_pem = app
                .keystore()
                .retrieve(RetrieveRequest {
                    key: key_alias.clone(),
                    prompt: None,
                })
                .await
                .map_err(|_| "secure_tls_key_unavailable".to_owned())?
                .value
                .ok_or_else(|| "secure_tls_key_unavailable".to_owned())?;
            return Ok(PhoneLanIdentity {
                certificate_pem: identity.certificate_pem,
                private_key_pem,
                fingerprint: identity.fingerprint,
                host_identity: identity.host_identity,
            });
        }
    }
    let identity = generate_phone_lan_identity(address)?;
    let persisted = PersistedPhoneLanIdentity {
        certificate_pem: identity.certificate_pem.clone(),
        fingerprint: identity.fingerprint.clone(),
        key_alias: key_alias.clone(),
        host_identity: identity.host_identity.clone(),
    };
    app.keystore()
        .store(StoreRequest {
            key: key_alias,
            value: identity.private_key_pem.clone(),
            prompt: None,
        })
        .await
        .map_err(|_| "secure_tls_key_unavailable".to_owned())?;
    fs::write(
        path,
        serde_json::to_vec(&persisted)
            .map_err(|error| format!("Could not encode Local Hub identity: {error}"))?,
    )
    .map_err(|error| format!("Could not persist Local Hub identity: {error}"))?;
    Ok(identity)
}

#[cfg(not(mobile))]
async fn load_or_generate_phone_lan_identity(
    _app: &tauri::AppHandle,
    _address: IpAddr,
) -> Result<PhoneLanIdentity, String> {
    Err("secure_phone_tls_storage_requires_mobile_keystore".to_owned())
}

fn detect_local_lan_address() -> Result<IpAddr, String> {
    if let Ok(interfaces) = if_addrs::get_if_addrs() {
        if let Some(address) = interfaces
            .into_iter()
            .map(|interface| interface.ip())
            .find(|address| is_preferred_lan_address(*address))
        {
            return Ok(address);
        }
    }

    let socket = UdpSocket::bind("0.0.0.0:0")
        .map_err(|error| format!("Could not inspect the local network: {error}"))?;
    socket
        .connect("8.8.8.8:80")
        .map_err(|error| format!("Could not resolve the local Wi-Fi route: {error}"))?;
    let address = socket
        .local_addr()
        .map_err(|error| format!("Could not read the local Wi-Fi address: {error}"))?
        .ip();
    if address.is_loopback() || address.is_unspecified() {
        return Err("The phone is not connected to a local Wi-Fi network".to_owned());
    }
    Ok(address)
}

fn is_preferred_lan_address(address: IpAddr) -> bool {
    match address {
        IpAddr::V4(address) => address.is_private() && !address.is_loopback(),
        IpAddr::V6(address) => address.is_unique_local() && !address.is_loopback(),
    }
}

fn generate_phone_lan_identity(address: IpAddr) -> Result<PhoneLanIdentity, String> {
    let _ = address;
    let mut identity_bytes = [0_u8; 8];
    getrandom::getrandom(&mut identity_bytes)
        .map_err(|error| format!("Could not create Local Hub host identity: {error}"))?;
    let host_identity = format!(
        "nexora-phone-{}.local",
        identity_bytes
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>()
    );
    let certificate =
        rcgen::generate_simple_self_signed(vec![host_identity.clone(), "localhost".to_owned()])
            .map_err(|error| {
                format!("Could not create the temporary Local Hub certificate: {error}")
            })?;
    let certificate_pem = certificate.cert.pem();
    let private_key_pem = certificate.key_pair.serialize_pem();
    let fingerprint = format!(
        "sha256:{}",
        Sha256::digest(certificate.cert.der().as_ref())
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>()
    );
    Ok(PhoneLanIdentity {
        certificate_pem,
        private_key_pem,
        fingerprint,
        host_identity,
    })
}

#[tauri::command]
async fn phone_local_hub_status(
    state: State<'_, LocalHubNativeState>,
) -> Result<HubRuntimeStatus, String> {
    let runtime = state.runtime.lock().await;
    match runtime.as_ref() {
        Some(runtime) => Ok(runtime.status().await),
        None => Ok(HubRuntimeStatus::default()),
    }
}

#[tauri::command]
async fn pc_manager_start_lan(
    app: tauri::AppHandle,
    state: State<'_, LocalHubNativeState>,
    request: LanHubStartRequest,
) -> Result<HubRuntimeStatus, String> {
    let mut runtime = state.runtime.lock().await;
    if runtime.is_some() {
        return Err("Stop the existing Local Hub before publishing it on LAN".to_owned());
    }
    let address: IpAddr = request
        .address
        .parse()
        .map_err(|_| "Invalid LAN address".to_owned())?;
    if address.is_loopback() || address.is_unspecified() {
        return Err("LAN publication requires a specific non-loopback address".to_owned());
    }
    let certificate_pem = fs::read_to_string(&request.certificate_path)
        .map_err(|_| "Could not read the selected TLS certificate".to_owned())?;
    let private_key_pem = fs::read_to_string(&request.private_key_path)
        .map_err(|_| "Could not read the selected TLS private key".to_owned())?;
    if certificate_pem.trim().is_empty() || private_key_pem.trim().is_empty() {
        return Err("TLS certificate and private key cannot be empty".to_owned());
    }
    let fingerprint = format!(
        "sha256:{}",
        Sha256::digest(certificate_pem.as_bytes())
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>()
    );
    let app_url = format!("https://{}/", std::net::SocketAddr::new(address, 43_173));
    let mut hub_state = LocalHubState::default();
    hub_state.app_url = Some(app_url);
    hub_state.browser_root = app
        .path()
        .resource_dir()
        .ok()
        .map(|directory| directory.join("browser"));
    let config = TransportSecurityConfig {
        binding: nexora_local_hub::BindingMode::Lan,
        address,
        port: 43_173,
        tls_certificate_pem: Some(certificate_pem),
        tls_private_key_pem: Some(private_key_pem),
        host_fingerprint: Some(fingerprint),
        host_identity: None,
    };
    let started = LocalHubRuntime::start(config, hub_state)
        .await
        .map_err(|error| format!("Local Hub LAN start failed: {error:?}"))?;
    let status = started.status().await;
    *runtime = Some(started);
    Ok(status)
}

#[tauri::command]
async fn pc_manager_status(
    state: State<'_, LocalHubNativeState>,
) -> Result<HubRuntimeStatus, String> {
    let runtime = state.runtime.lock().await;
    match runtime.as_ref() {
        Some(runtime) => Ok(runtime.status().await),
        None => Ok(HubRuntimeStatus::default()),
    }
}

#[tauri::command]
async fn pc_manager_create_pairing_invite(
    state: State<'_, LocalHubNativeState>,
) -> Result<PairingInvite, String> {
    let runtime = state.runtime.lock().await;
    runtime
        .as_ref()
        .ok_or_else(|| "Local Hub is not running".to_owned())?
        .create_pairing_invite()
        .await
        .map_err(|error| format!("Pairing invite failed: {error:?}"))
}

#[tauri::command]
async fn phone_local_hub_create_pairing_invite(
    state: State<'_, LocalHubNativeState>,
) -> Result<PairingInvite, String> {
    let runtime = state.runtime.lock().await;
    runtime
        .as_ref()
        .ok_or_else(|| "Local Hub is not running".to_owned())?
        .create_pairing_invite()
        .await
        .map_err(|error| format!("Phone pairing invite failed: {error:?}"))
}

#[tauri::command]
async fn pc_manager_stop(state: State<'_, LocalHubNativeState>) -> Result<(), String> {
    let mut runtime = state.runtime.lock().await;
    if let Some(mut runtime) = runtime.take() {
        runtime
            .stop()
            .await
            .map_err(|error| format!("Local Hub stop failed: {error:?}"))?;
    }
    Ok(())
}

#[tauri::command]
async fn phone_local_hub_stop(state: State<'_, LocalHubNativeState>) -> Result<(), String> {
    let mut runtime = state.runtime.lock().await;
    if let Some(mut runtime) = runtime.take() {
        runtime
            .stop()
            .await
            .map_err(|error| format!("Phone Local Hub stop failed: {error:?}"))?;
    }
    Ok(())
}

fn database_path(app: &tauri::AppHandle, database_url: &str) -> Result<PathBuf, String> {
    let filename = validate_database_filename(database_url)?;
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not resolve native app data directory: {error}"))?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Could not create native app data directory: {error}"))?;
    Ok(directory.join(filename))
}

fn validate_database_filename(database_url: &str) -> Result<&str, String> {
    let filename = database_url
        .strip_prefix("sqlite:")
        .ok_or_else(|| "Invalid native SQLite database URL".to_string())?;
    let mut characters = filename.chars();
    let first = characters
        .next()
        .filter(|character| character.is_ascii_alphanumeric())
        .ok_or_else(|| "Invalid native SQLite database URL".to_string())?;
    let valid_length = filename.len() <= 128;
    let valid_characters = characters
        .all(|character| character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '-'));
    if valid_length && (first.is_ascii_alphanumeric()) && valid_characters {
        Ok(filename)
    } else {
        Err("Invalid native SQLite database URL".to_string())
    }
}

fn parameter(value: JsonValue) -> Result<Value, String> {
    match value {
        JsonValue::Null => Ok(Value::Null),
        JsonValue::Bool(value) => Ok(Value::Integer(i64::from(value))),
        JsonValue::Number(value) => value
            .as_i64()
            .map(Value::Integer)
            .or_else(|| value.as_f64().map(Value::Real))
            .ok_or_else(|| "Unsupported SQLite numeric parameter".to_string()),
        JsonValue::String(value) => Ok(Value::Text(value)),
        JsonValue::Array(values) => values
            .into_iter()
            .map(|value| match value {
                JsonValue::Number(number) => number
                    .as_u64()
                    .and_then(|value| u8::try_from(value).ok())
                    .ok_or_else(|| "Invalid SQLite blob parameter".to_string()),
                _ => Err("SQLite blob parameters must contain bytes".to_string()),
            })
            .collect::<Result<Vec<_>, _>>()
            .map(Value::Blob),
        JsonValue::Object(_) => Err("Unsupported SQLite object parameter".to_string()),
    }
}

fn json_value(row: &rusqlite::Row<'_>, index: usize) -> Result<JsonValue, String> {
    Ok(
        match row.get_ref(index).map_err(|error| error.to_string())? {
            rusqlite::types::ValueRef::Null => JsonValue::Null,
            rusqlite::types::ValueRef::Integer(value) => JsonValue::from(value),
            rusqlite::types::ValueRef::Real(value) => JsonValue::from(value),
            rusqlite::types::ValueRef::Text(value) => {
                JsonValue::from(String::from_utf8_lossy(value).into_owned())
            }
            rusqlite::types::ValueRef::Blob(value) => {
                JsonValue::Array(value.iter().copied().map(JsonValue::from).collect())
            }
        },
    )
}

#[tauri::command]
fn nexora_sql_begin_transaction(
    app: tauri::AppHandle,
    state: State<'_, NativeTransactionState>,
    database_url: String,
) -> Result<String, String> {
    let connection =
        Connection::open(database_path(&app, &database_url)?).map_err(|error| error.to_string())?;
    connection
        .execute_batch("PRAGMA foreign_keys = ON; BEGIN IMMEDIATE;")
        .map_err(|error| error.to_string())?;
    let transaction_id = format!("tx-{}", state.next_id.fetch_add(1, Ordering::Relaxed));
    state
        .connections
        .lock()
        .map_err(|_| "Native SQLite transaction state is poisoned".to_string())?
        .insert(transaction_id.clone(), connection);
    Ok(transaction_id)
}

#[tauri::command]
fn nexora_sql_transaction_execute(
    state: State<'_, NativeTransactionState>,
    transaction_id: String,
    sql: String,
    parameters: Vec<JsonValue>,
) -> Result<(), String> {
    let values = parameters
        .into_iter()
        .map(parameter)
        .collect::<Result<Vec<_>, _>>()?;
    let mut connections = state
        .connections
        .lock()
        .map_err(|_| "Native SQLite transaction state is poisoned".to_string())?;
    let connection = connections
        .get_mut(&transaction_id)
        .ok_or_else(|| "Native SQLite transaction does not exist".to_string())?;
    connection
        .execute(&sql, params_from_iter(values.iter()))
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn nexora_sql_transaction_select(
    state: State<'_, NativeTransactionState>,
    transaction_id: String,
    sql: String,
    parameters: Vec<JsonValue>,
) -> Result<Vec<JsonValue>, String> {
    let values = parameters
        .into_iter()
        .map(parameter)
        .collect::<Result<Vec<_>, _>>()?;
    let mut connections = state
        .connections
        .lock()
        .map_err(|_| "Native SQLite transaction state is poisoned".to_string())?;
    let connection = connections
        .get_mut(&transaction_id)
        .ok_or_else(|| "Native SQLite transaction does not exist".to_string())?;
    let mut statement = connection
        .prepare(&sql)
        .map_err(|error| error.to_string())?;
    let names = statement
        .column_names()
        .into_iter()
        .map(str::to_owned)
        .collect::<Vec<_>>();
    let mut rows = statement
        .query(params_from_iter(values.iter()))
        .map_err(|error| error.to_string())?;
    let mut result = Vec::new();
    while let Some(row) = rows.next().map_err(|error| error.to_string())? {
        let mut object = Map::new();
        for (index, name) in names.iter().enumerate() {
            object.insert(name.clone(), json_value(row, index)?);
        }
        result.push(JsonValue::Object(object));
    }
    Ok(result)
}

fn finish_transaction(
    state: State<'_, NativeTransactionState>,
    transaction_id: String,
    sql: &str,
) -> Result<(), String> {
    let mut connections = state
        .connections
        .lock()
        .map_err(|_| "Native SQLite transaction state is poisoned".to_string())?;
    let connection = connections
        .remove(&transaction_id)
        .ok_or_else(|| "Native SQLite transaction does not exist".to_string())?;
    connection
        .execute_batch(sql)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn nexora_sql_commit_transaction(
    state: State<'_, NativeTransactionState>,
    transaction_id: String,
) -> Result<(), String> {
    finish_transaction(state, transaction_id, "COMMIT;")
}

#[tauri::command]
fn nexora_sql_rollback_transaction(
    state: State<'_, NativeTransactionState>,
    transaction_id: String,
) -> Result<(), String> {
    finish_transaction(state, transaction_id, "ROLLBACK;")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .manage(NativeTransactionState::default())
        .manage(LocalHubNativeState::default())
        .invoke_handler(tauri::generate_handler![
            local_host_request,
            pc_manager_start,
            phone_local_hub_start,
            phone_local_hub_status,
            pc_manager_start_lan,
            pc_manager_status,
            pc_manager_create_pairing_invite,
            phone_local_hub_create_pairing_invite,
            pc_manager_stop,
            phone_local_hub_stop,
            nexora_sql_begin_transaction,
            nexora_sql_transaction_execute,
            nexora_sql_transaction_select,
            nexora_sql_commit_transaction,
            nexora_sql_rollback_transaction
        ])
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build());
    #[cfg(mobile)]
    let builder = builder.plugin(tauri_plugin_keystore::init());
    builder
        .run(tauri::generate_context!())
        .expect("Nexora native runtime failed to start");
}

#[cfg(test)]
mod tests {
    use super::{
        generate_phone_lan_identity, validate_database_filename, verify_certificate_fingerprint,
    };
    use std::net::IpAddr;

    #[test]
    fn accepts_the_default_relative_sqlite_filename() {
        assert_eq!(
            validate_database_filename("sqlite:nexora.db"),
            Ok("nexora.db")
        );
    }

    #[test]
    fn rejects_paths_and_invalid_filenames() {
        for database_url in [
            "sqlite:",
            "sqlite:../other.db",
            "sqlite:folder/other.db",
            "sqlite:\\other.db",
            "sqlite:.hidden.db",
            "sqlite:other db",
        ] {
            assert!(
                validate_database_filename(database_url).is_err(),
                "{database_url}"
            );
        }
    }

    #[test]
    fn phone_tls_identity_has_a_stable_certificate_fingerprint_contract() {
        let identity =
            generate_phone_lan_identity("192.0.2.10".parse::<IpAddr>().unwrap()).unwrap();
        let mut reader = std::io::Cursor::new(identity.certificate_pem.as_bytes());
        let certificate = rustls_pemfile::certs(&mut reader).next().unwrap().unwrap();
        assert!(
            verify_certificate_fingerprint(certificate.as_ref(), &identity.fingerprint).is_ok()
        );
        assert!(verify_certificate_fingerprint(certificate.as_ref(), "sha256:deadbeef").is_err());
    }

    #[test]
    fn persisted_phone_identity_never_serializes_the_private_key() {
        let identity =
            generate_phone_lan_identity("192.0.2.10".parse::<IpAddr>().unwrap()).unwrap();
        let persisted = super::PersistedPhoneLanIdentity {
            certificate_pem: identity.certificate_pem,
            fingerprint: identity.fingerprint,
            key_alias: "nexora.local-hub.tls.v1".to_owned(),
            host_identity: identity.host_identity,
        };
        let json = serde_json::to_string(&persisted).unwrap();
        assert!(!json.contains("private_key_pem"));
        assert!(!json.contains("PRIVATE KEY"));
    }
}
