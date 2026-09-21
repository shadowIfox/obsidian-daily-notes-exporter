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

/// Подпись горячей клавиши в меню значка (только подсказка; сама клавиша регистрируется ниже).
#[cfg(target_os = "macos")]
const NEW_TASK_HINT: &str = "Alt+Cmd+N";
#[cfg(not(target_os = "macos"))]
const NEW_TASK_HINT: &str = "Ctrl+Alt+N";
#[cfg(target_os = "macos")]
const QUIT_HINT: Option<&str> = Some("Cmd+Q");
#[cfg(not(target_os = "macos"))]
const QUIT_HINT: Option<&str> = None;

/// Показывает главное окно поверх остальных (из меню-бара, из Dock, по горячей клавише).
pub fn show_main_window(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        log::warn!("Не удалось показать окно: главное окно не найдено");
        return;
    };
    let _ = window.unminimize();
    if let Err(e) = window.show() {
        log::warn!("Не удалось показать окно: {e}");
    }
    let _ = window.set_focus();
}

/// Открывает окно приложения и просит интерфейс показать «Новая задача».
pub fn request_new_task(app: &AppHandle) {
    show_main_window(app);
    let _ = app.emit(NEW_TASK_EVENT, ());
}

/// Значок в меню-баре: слева открывает меню «Открыть / Новая задача / Выйти».
pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Открыть «Мой день»", true, None::<&str>)?;
    let new_task = MenuItem::with_id(app, "new-task", "Новая задача", true, Some(NEW_TASK_HINT))?;
    let quit = MenuItem::with_id(app, "quit", "Выйти", true, QUIT_HINT)?;
    let menu = Menu::with_items(app, &[&open, &new_task, &PredefinedMenuItem::separator(app)?, &quit])?;

    let builder = TrayIconBuilder::with_id("main").tooltip("Мой день").menu(&menu);

    // Mac: монохромный «шаблон», macOS красит его под тёмную и светлую строку меню; левый клик открывает меню.
    #[cfg(target_os = "macos")]
    let builder = builder
        .icon(tauri::include_image!("icons/tray.png"))
        .icon_as_template(true)
        .show_menu_on_left_click(true);

    // Windows: чёрный шаблон на тёмной панели задач не виден, поэтому цветной значок приложения;
    // левый клик открывает окно, правый — меню (как принято в Windows).
    #[cfg(not(target_os = "macos"))]
    let builder = {
        use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
        let builder = builder.show_menu_on_left_click(false).on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });
        match app.default_window_icon() {
            Some(icon) => builder.icon(icon.clone()),
            None => builder,
        }
    };

    builder
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main_window(app),
            "new-task" => request_new_task(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;
    Ok(())
}

/// Глобальная горячая клавиша «Новая задача», работает из любого приложения: ⌥⌘N на Mac, Ctrl+Alt+N на Windows.
/// (Клавиша Win для приложений плохо подходит, а Ctrl+Shift+N перехватила бы «инкогнито» в браузере.)
fn new_task_shortcut() -> Shortcut {
    #[cfg(target_os = "macos")]
    let modifiers = Modifiers::ALT | Modifiers::SUPER;
    #[cfg(not(target_os = "macos"))]
    let modifiers = Modifiers::ALT | Modifiers::CONTROL;
    Shortcut::new(Some(modifiers), Code::KeyN)
}

/// Плагин горячих клавиш: по сочетанию «Новая задача» открывает окно «Новая задача».
pub fn global_shortcut_plugin() -> TauriPlugin<Wry> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, shortcut, event| {
            if event.state() == ShortcutState::Pressed && *shortcut == new_task_shortcut() {
                request_new_task(app);
            }
        })
        .build()
}

/// Регистрирует горячую клавишу «Новая задача». Если сочетание занято другим приложением, это не ошибка запуска: приложение работает без него.
pub fn register_new_task_shortcut(app: &AppHandle) {
    if let Err(e) = app.global_shortcut().register(new_task_shortcut()) {
        log::warn!("Не удалось занять горячую клавишу для «Новая задача»: {e}");
    }
}
