// Babbage AI — desktop entrypoint.
//
// Tauri 2.0 spawns a native window (WebKitGTK on Linux, WKWebView on macOS,
// WebView2 on Windows) and points it at the URL in tauri.conf.json (the
// production Babbage web app). We expose a single Rust command —
// `app_info` — so the React frontend can detect it's running inside the
// desktop shell and adjust UX (e.g. native file pickers, system tray).
//
// To keep the binary small we DON'T pull in any of Tauri's optional
// plugins by default. Add them in Cargo.toml + here as needed (notifs,
// auto-updater, deep links, single-instance, etc.).

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;

#[derive(Serialize)]
struct AppInfo {
    name: &'static str,
    version: &'static str,
    target_os: &'static str,
    target_arch: &'static str,
}

#[tauri::command]
fn app_info() -> AppInfo {
    AppInfo {
        name: "Babbage AI",
        version: env!("CARGO_PKG_VERSION"),
        target_os:   std::env::consts::OS,
        target_arch: std::env::consts::ARCH,
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![app_info])
        .run(tauri::generate_context!())
        .expect("error while running Babbage AI desktop");
}
