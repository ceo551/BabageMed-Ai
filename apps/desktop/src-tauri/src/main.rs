// Babbage AI — desktop entrypoint.
//
// Tauri 2.0 spawns a native window (WebView2 on Windows, WKWebView on
// macOS, WebKitGTK on Linux) pointed at the hosted Babbage web app.
// The Rust side exposes hardware introspection, secure-storage, native
// dialogs, deep links, auto-updates, global shortcuts and a system tray
// so the desktop client is more than a glorified browser.
//
// Performance switches that have to be set BEFORE the WebView starts
// live in `perf::install_pre_init_env` and run in `main()` before
// `tauri::Builder` does anything.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod perf;
mod secure;
mod system;
mod tray;
mod window_ops;

use tauri::Manager;
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_log::{Target, TargetKind};

fn main() {
    perf::install_pre_init_env();

    let builder = tauri::Builder::default()
        // Single-instance must be the FIRST plugin. When a second copy is
        // launched it forwards its argv/cwd here and we surface the main
        // window instead of opening a duplicate.
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.show();
                let _ = w.set_focus();
            }
            // Forward CLI args (and deep-link URLs delivered as argv on
            // Windows/Linux) to the web app so it can route to the right
            // screen.
            if let Some(w) = app.get_webview_window("main") {
                if let Ok(json) = serde_json::to_string(&argv) {
                    let _ = w.eval(&format!(
                        "window.dispatchEvent(new CustomEvent('babbage:cli', {{ detail: {} }}))",
                        json
                    ));
                }
            }
        }))
        .plugin(tauri_plugin_log::Builder::new()
            .targets([
                Target::new(TargetKind::Stdout),
                Target::new(TargetKind::LogDir { file_name: None }),
                Target::new(TargetKind::Webview),
            ])
            .level(log::LevelFilter::Info)
            .build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::default().build())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .plugin(tauri_plugin_global_shortcut::Builder::new()
            .with_handler(|app, shortcut, event| {
                if event.state() != ShortcutState::Pressed { return; }
                // Cmd/Ctrl+Shift+Space → focus the app from anywhere on
                // the OS, mimicking Spotlight/Alfred. We dispatch a
                // browser event so the web app can pop its command
                // palette in response.
                let summon: Shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space);
                let summon_mac: Shortcut = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::Space);
                if shortcut == &summon || shortcut == &summon_mac {
                    if let Some(w) = app.get_webview_window("main") {
                        let _ = w.unminimize();
                        let _ = w.show();
                        let _ = w.set_focus();
                        let _ = w.eval("window.dispatchEvent(new CustomEvent('babbage:summon'))");
                    }
                }
            })
            .build())
        .manage(system::SysState::new())
        .invoke_handler(tauri::generate_handler![
            // window/perf
            window_ops::app_info,
            window_ops::focus_main,
            window_ops::toggle_devtools,
            window_ops::request_user_attention,
            window_ops::set_always_on_top,
            window_ops::toggle_fullscreen,
            window_ops::apply_perf_hints,
            // hardware
            system::system_snapshot,
            system::gpu_adapters,
            system::battery_status,
            // secure storage
            secure::secret_set,
            secure::secret_get,
            secure::secret_delete,
        ])
        .setup(|app| {
            // Register the global summon shortcut. Failing to register
            // (another app already owns it) is logged but doesn't abort
            // startup — the desktop client still works without it.
            let summon = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space);
            let summon_mac = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::Space);
            if let Err(e) = app.global_shortcut().register(summon) {
                log::warn!("failed to register Ctrl+Shift+Space: {e}");
            }
            if let Err(e) = app.global_shortcut().register(summon_mac) {
                log::warn!("failed to register Cmd+Shift+Space: {e}");
            }

            // Build the tray AFTER plugins are wired so it can read the
            // bundled icon and access plugin state on click.
            if let Err(e) = tray::install(app.handle()) {
                log::warn!("tray init failed: {e}");
            }

            // Surface the app version + targets to logs on every launch.
            log::info!(
                "Babbage AI desktop {} starting on {}/{} (cores: {} physical / {} logical)",
                env!("CARGO_PKG_VERSION"),
                std::env::consts::OS,
                std::env::consts::ARCH,
                num_cpus::get_physical(),
                num_cpus::get(),
            );
            Ok(())
        });

    builder
        .run(tauri::generate_context!())
        .expect("error while running Babbage AI desktop");
}
