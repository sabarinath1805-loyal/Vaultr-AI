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

#[derive(serde::Serialize)]
struct FilePayload {
    filename: String,
    bytes: Vec<u8>,
}

#[tauri::command]
fn read_files(paths: Vec<String>) -> Result<Vec<FilePayload>, String> {
    paths
        .into_iter()
        .map(|p| {
            let path = PathBuf::from(&p);
            let filename = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| p.clone());
            let bytes = fs::read(&path).map_err(|e| format!("Failed to read {}: {}", p, e))?;
            Ok(FilePayload { filename, bytes })
        })
        .collect()
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
