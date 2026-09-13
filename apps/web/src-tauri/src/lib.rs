use std::collections::HashMap;
use std::fs;
use std::net::IpAddr;
use std::path::PathBuf;
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};

use nexora_local_hub::{
    HubRuntimeStatus, LocalHubRuntime, LocalHubState, PairingInvite, TransportSecurityConfig,
};
use rusqlite::{Connection, params_from_iter, types::Value};
use serde_json::{Map, Value as JsonValue};
use sha2::{Digest, Sha256};
use tauri::{Manager, State};
use tokio::sync::Mutex as AsyncMutex;

#[derive(Default)]
struct NativeTransactionState {
    next_id: AtomicU64,
    connections: Mutex<HashMap<String, Connection>>,
}

#[derive(Default)]
struct LocalHubDesktopState {
    runtime: AsyncMutex<Option<LocalHubRuntime>>,
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
    state: State<'_, LocalHubDesktopState>,
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

#[tauri::command]
async fn pc_manager_start_lan(
    app: tauri::AppHandle,
    state: State<'_, LocalHubDesktopState>,
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
    state: State<'_, LocalHubDesktopState>,
) -> Result<HubRuntimeStatus, String> {
    let runtime = state.runtime.lock().await;
    match runtime.as_ref() {
        Some(runtime) => Ok(runtime.status().await),
        None => Ok(HubRuntimeStatus::default()),
    }
}

#[tauri::command]
async fn pc_manager_create_pairing_invite(
    state: State<'_, LocalHubDesktopState>,
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
async fn pc_manager_stop(state: State<'_, LocalHubDesktopState>) -> Result<(), String> {
    let mut runtime = state.runtime.lock().await;
    if let Some(mut runtime) = runtime.take() {
        runtime
            .stop()
            .await
            .map_err(|error| format!("Local Hub stop failed: {error:?}"))?;
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
    tauri::Builder::default()
        .manage(NativeTransactionState::default())
        .manage(LocalHubDesktopState::default())
        .invoke_handler(tauri::generate_handler![
            pc_manager_start,
            pc_manager_start_lan,
            pc_manager_status,
            pc_manager_create_pairing_invite,
            pc_manager_stop,
            nexora_sql_begin_transaction,
            nexora_sql_transaction_execute,
            nexora_sql_transaction_select,
            nexora_sql_commit_transaction,
            nexora_sql_rollback_transaction
        ])
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("Nexora native runtime failed to start");
}

#[cfg(test)]
mod tests {
    use super::validate_database_filename;

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
}
