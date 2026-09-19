mod db;
mod vault;

use db::Db;
use std::fs;
use tauri::{Manager, State};

/// Читает значение по ключу; None — ключа в базе ещё нет.
#[tauri::command]
fn storage_read(db: State<Db>, key: String) -> Result<Option<String>, String> {
    db.read(&key)
}

/// Записывает значение (JSON-текст) целиком.
#[tauri::command]
fn storage_write(db: State<Db>, key: String, value: String) -> Result<(), String> {
    db.write(&key, &value)
}

/// Текст заметки за день из vault Obsidian; None — заметки ещё нет.
#[tauri::command]
fn vault_read_note(vault: String, date: String) -> Result<Option<String>, String> {
    vault::read_note(&vault, &date)
}

/// Записывает заметку за день в <vault>/daily-notes/<дата>.md.
#[tauri::command]
fn vault_write_note(vault: String, date: String, content: String) -> Result<(), String> {
    vault::write_note(&vault, &date, &content)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle()
                    .plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build())?;
            }
            // База лежит в папке данных приложения: ~/Library/Application Support/com.shadowifox.myday/
            let dir = app.path().app_data_dir()?;
            fs::create_dir_all(&dir)?;
            let db = Db::open(&dir.join("myday.sqlite"))?;
            app.manage(db);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            storage_read,
            storage_write,
            vault_read_note,
            vault_write_note
        ])
        .run(tauri::generate_context!())
        .expect("не удалось запустить приложение");
}
