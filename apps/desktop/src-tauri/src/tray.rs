// System tray icon + menu. Survives window close on Windows/Linux —
// right-click → menu, left-click → focus the main window.

use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

pub fn install(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Open Babbage AI", true, None::<&str>)?;
    let new_chat = MenuItem::with_id(app, "new_chat", "New chat", true, Some("CmdOrCtrl+N"))?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, Some("CmdOrCtrl+Q"))?;

    let menu = Menu::with_items(app, &[&show, &new_chat, &sep, &quit])?;

    // Reuse the application icon for the tray. Tauri's default_window_icon
    // is the bundled .ico / .icns / .png from tauri.conf.json.
    let icon = app.default_window_icon().cloned().unwrap_or_else(|| {
        // Should not happen — generate_context! always wires the default
        // icon — but we don't want to panic if a bundle is built without one.
        Image::new_owned(vec![0u8; 4], 1, 1)
    });

    TrayIconBuilder::with_id("babbage-tray")
        .icon(icon)
        .icon_as_template(false)
        .tooltip("Babbage AI")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, ev| match ev.id.as_ref() {
            "show" => focus_main(app),
            "new_chat" => {
                focus_main(app);
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.eval("window.dispatchEvent(new CustomEvent('babbage:new-chat'))");
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, ev| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = ev {
                focus_main(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn focus_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}
