// shell.rs — «оболочка» приложения для Mac: значок в меню-баре, показ окна и запрос «Новая задача».

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    plugin::TauriPlugin,
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, Wry,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

/// Событие для фронтенда: открыть окно «Новая задача».
pub const NEW_TASK_EVENT: &str = "open-new-task";

/// Показывает главное окно поверх остальных (из меню-бара, из Dock, по горячей клавише).
pub fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Открывает окно приложения и просит интерфейс показать «Новая задача».
pub fn request_new_task(app: &AppHandle) {
    show_main_window(app);
    let _ = app.emit(NEW_TASK_EVENT, ());
}

/// Значок в меню-баре: слева открывает меню «Открыть / Новая задача / Выйти».
pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Открыть «Мой день»", true, None::<&str>)?;
    let new_task = MenuItem::with_id(app, "new-task", "Новая задача", true, Some("Alt+Cmd+N"))?;
    let quit = MenuItem::with_id(app, "quit", "Выйти", true, Some("Cmd+Q"))?;
    let menu = Menu::with_items(app, &[&open, &new_task, &PredefinedMenuItem::separator(app)?, &quit])?;

    TrayIconBuilder::with_id("main")
        .icon(tauri::include_image!("icons/tray.png"))
        .icon_as_template(true) // macOS сам красит значок под тёмную и светлую строку меню
        .tooltip("Мой день")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main_window(app),
            "new-task" => request_new_task(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;
    Ok(())
}

/// Глобальная горячая клавиша «Новая задача»: ⌥⌘N, работает из любого приложения.
fn new_task_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::ALT | Modifiers::SUPER), Code::KeyN)
}

/// Плагин горячих клавиш: по ⌥⌘N открывает окно «Новая задача».
pub fn global_shortcut_plugin() -> TauriPlugin<Wry> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, shortcut, event| {
            if event.state() == ShortcutState::Pressed && *shortcut == new_task_shortcut() {
                request_new_task(app);
            }
        })
        .build()
}

/// Регистрирует ⌥⌘N. Если сочетание занято другим приложением, это не ошибка запуска: приложение работает без него.
pub fn register_new_task_shortcut(app: &AppHandle) {
    if let Err(e) = app.global_shortcut().register(new_task_shortcut()) {
        log::warn!("Не удалось занять горячую клавишу ⌥⌘N: {e}");
    }
}
