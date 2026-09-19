mod db;
mod notify;
mod shell;

use db::Db;
use std::fs;
use tauri::{Manager, State, WindowEvent};

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

/// Пробное уведомление (кнопка в настройках): по нему macOS спрашивает разрешение и видно, как выглядят напоминания.
#[tauri::command]
fn send_test_notification(app: tauri::AppHandle) -> Result<(), String> {
    notify::send_test(&app)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(shell::global_shortcut_plugin())
        .plugin(tauri_plugin_notification::init())
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
            shell::setup_tray(app.handle())?;
            shell::register_new_task_shortcut(app.handle());
            notify::start_scheduler(app.handle().clone());
            Ok(())
        })
        // Красная кнопка окна не завершает приложение, а прячет окно: оно остаётся в меню-баре
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![storage_read, storage_write, send_test_notification])
        .build(tauri::generate_context!())
        .expect("не удалось собрать приложение")
        .run(|app, event| {
            // Клик по значку в Dock, когда окно спрятано, возвращает окно
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen {
                has_visible_windows: false,
                ..
            } = event
            {
                shell::show_main_window(app);
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (app, event);
        });
}
