use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};

use rusqlite::{Connection, params_from_iter, types::Value};
use serde_json::{Map, Value as JsonValue};
use tauri::{Manager, State};

#[derive(Default)]
struct NativeTransactionState {
    next_id: AtomicU64,
    connections: Mutex<HashMap<String, Connection>>,
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
        .invoke_handler(tauri::generate_handler![
            nexora_sql_begin_transaction,
            nexora_sql_transaction_execute,
            nexora_sql_transaction_select,
            nexora_sql_commit_transaction,
            nexora_sql_rollback_transaction
        ])
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
