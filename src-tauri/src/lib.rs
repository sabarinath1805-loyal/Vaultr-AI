use std::{collections::HashMap, fs, path::PathBuf};
use tauri::Manager;

const API_KEY_NAMES: [&str; 4] = [
    "GROQ_API_KEY",
    "TAVILY_API_KEY",
    "GEMINI_API_KEY",
    "OLLAMA_API_KEY",
];

#[tauri::command]
fn get_api_key_status(app: tauri::AppHandle) -> Result<HashMap<String, bool>, String> {
    let saved_keys = read_saved_api_keys(&app)?;
    Ok(API_KEY_NAMES
        .into_iter()
        .map(|name| {
            let configured = std::env::var(name)
                .map(|value| !value.trim().is_empty())
                .unwrap_or(false)
                || saved_keys
                    .get(name)
                    .map(|value| !value.trim().is_empty())
                    .unwrap_or(false);
            (name.to_string(), configured)
        })
        .collect())
}

#[tauri::command]
fn save_api_keys(
    app: tauri::AppHandle,
    keys: HashMap<String, String>,
) -> Result<HashMap<String, bool>, String> {
    let mut saved_keys = read_saved_api_keys(&app)?;
    for name in API_KEY_NAMES {
        if let Some(value) = keys.get(name) {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                saved_keys.remove(name);
            } else {
                saved_keys.insert(name.to_string(), trimmed.to_string());
            }
        }
    }

    let api_keys_path = api_keys_path(&app)?;
    if let Some(parent) = api_keys_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let serialized = serde_json::to_string_pretty(&saved_keys).map_err(|error| error.to_string())?;
    fs::write(api_keys_path, serialized).map_err(|error| error.to_string())?;
    get_api_key_status(app)
}

fn read_saved_api_keys(app: &tauri::AppHandle) -> Result<HashMap<String, String>, String> {
    let api_keys_path = api_keys_path(app)?;
    let raw = match fs::read_to_string(api_keys_path) {
        Ok(raw) => raw,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(HashMap::new());
        }
        Err(error) => return Err(error.to_string()),
    };

    serde_json::from_str(&raw).map_err(|error| error.to_string())
}

fn api_keys_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join(".vaultr")
        .join("api-keys.json"))
}

// Maximum number of files accepted per `read_files` call. The dialog picker
// exposes this through multi-select; legitimate scans never need more.
const MAX_READ_FILES_BATCH: usize = 20;

// Maximum size of any single file accepted by `read_files`. Sized to clear the
// largest plausible contract PDF (~50 MiB) with headroom, while still refusing
// pagefile.sys / hiberfil.sys / multi-gigabyte binaries that would OOM the
// WebView host.
const MAX_READ_FILE_BYTES: u64 = 100 * 1024 * 1024;

// Extensions accepted by `read_files`. The dialog plugin's open() already
// filters the picker to these, but the Rust side must enforce the contract
// independently — any XSS or compromised JS dep could bypass the picker and
// call `read_files` with arbitrary paths.
const ALLOWED_READ_EXTENSIONS: &[&str] = &["pdf", "doc", "docx", "txt"];

#[derive(serde::Serialize)]
struct FilePayload {
    filename: String,
    bytes: Vec<u8>,
    /// Set to a human-readable reason when this file could not be read.
    /// Callers MUST treat any non-null `error` as a hard failure for the
    /// individual file (do not surface the bytes).
    error: Option<String>,
}

#[tauri::command]
fn read_files(paths: Vec<String>) -> Result<Vec<FilePayload>, String> {
    if paths.len() > MAX_READ_FILES_BATCH {
        return Err(format!(
            "Too many files in one call: {} (max {})",
            paths.len(),
            MAX_READ_FILES_BATCH
        ));
    }

    Ok(paths
        .into_iter()
        .map(|p| read_one_file(&p))
        .collect())
}

fn read_one_file(raw_path: &str) -> FilePayload {
    // Canonicalize first: resolves `..` and symlinks, so a caller cannot trick
    // us into reading outside the user's intended pick.
    let canonical = match fs::canonicalize(raw_path) {
        Ok(p) => p,
        Err(e) => {
            return FilePayload {
                filename: raw_path.to_string(),
                bytes: Vec::new(),
                error: Some(format!("Path could not be resolved: {}", e)),
            };
        }
    };

    // The dialog picker hands us absolute paths; if canonicalize produced
    // something that isn't absolute, treat it as suspicious.
    if !canonical.is_absolute() {
        return FilePayload {
            filename: raw_path.to_string(),
            bytes: Vec::new(),
            error: Some("Resolved path is not absolute".to_string()),
        };
    }

    // Extension allowlist on the canonicalized path's filename.
    let filename = canonical
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| raw_path.to_string());

    let ext_ok = canonical
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| {
            let lower = e.to_ascii_lowercase();
            ALLOWED_READ_EXTENSIONS.iter().any(|allowed| *allowed == lower)
        })
        .unwrap_or(false);

    if !ext_ok {
        return FilePayload {
            filename,
            bytes: Vec::new(),
            error: Some(format!(
                "File extension not allowed (accepted: {})",
                ALLOWED_READ_EXTENSIONS.join(", ")
            )),
        };
    }

    // Stat first, refuse anything over the cap before reading into memory.
    let metadata = match fs::metadata(&canonical) {
        Ok(m) => m,
        Err(e) => {
            return FilePayload {
                filename,
                bytes: Vec::new(),
                error: Some(format!("Stat failed: {}", e)),
            };
        }
    };

    if !metadata.file_type().is_file() {
        return FilePayload {
            filename,
            bytes: Vec::new(),
            error: Some("Not a regular file".to_string()),
        };
    }

    if metadata.len() > MAX_READ_FILE_BYTES {
        return FilePayload {
            filename,
            bytes: Vec::new(),
            error: Some(format!(
                "File too large: {} bytes (max {})",
                metadata.len(),
                MAX_READ_FILE_BYTES
            )),
        };
    }

    match fs::read(&canonical) {
        Ok(bytes) => FilePayload {
            filename,
            bytes,
            error: None,
        },
        Err(e) => FilePayload {
            filename,
            bytes: Vec::new(),
            error: Some(format!("Read failed: {}", e)),
        },
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .enable_macos_default_menu(true)
        .invoke_handler(tauri::generate_handler![get_api_key_status, save_api_keys, read_files])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            if let Ok(app_data_dir) = app.path().app_data_dir() {
                std::env::set_var("VAULTR_APP_DATA_DIR", app_data_dir.join(".vaultr"));
            }

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
