// Window/perf utilities the React layer triggers via @tauri-apps/api.

use serde::Serialize;
use tauri::WebviewWindow;

#[derive(Serialize)]
pub struct AppInfo {
    pub name: &'static str,
    pub version: &'static str,
    pub target_os: &'static str,
    pub target_arch: &'static str,
    pub physical_cores: usize,
    pub logical_cores: usize,
}

#[tauri::command]
pub fn app_info() -> AppInfo {
    AppInfo {
        name: "Babbage AI",
        version: env!("CARGO_PKG_VERSION"),
        target_os: std::env::consts::OS,
        target_arch: std::env::consts::ARCH,
        physical_cores: num_cpus::get_physical(),
        logical_cores: num_cpus::get(),
    }
}

#[tauri::command]
pub fn focus_main(win: WebviewWindow) -> Result<(), String> {
    let _ = win.unminimize();
    let _ = win.show();
    win.set_focus().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_devtools(win: WebviewWindow) {
    #[cfg(debug_assertions)]
    {
        if win.is_devtools_open() {
            win.close_devtools();
        } else {
            win.open_devtools();
        }
    }
    #[cfg(not(debug_assertions))]
    {
        let _ = win; // suppress unused warning on release
    }
}

#[tauri::command]
pub fn request_user_attention(win: WebviewWindow, critical: bool) -> Result<(), String> {
    let req = if critical {
        Some(tauri::UserAttentionType::Critical)
    } else {
        Some(tauri::UserAttentionType::Informational)
    };
    win.request_user_attention(req).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_always_on_top(win: WebviewWindow, on: bool) -> Result<(), String> {
    win.set_always_on_top(on).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_fullscreen(win: WebviewWindow) -> Result<(), String> {
    let fs = win.is_fullscreen().map_err(|e| e.to_string())?;
    win.set_fullscreen(!fs).map_err(|e| e.to_string())
}

/// Apply OS-level GPU/scheduling hints. Most of these have to be set
/// BEFORE the WebView is created (see `perf::install_pre_init_env`).
/// This command is kept so the JS layer can re-trigger less invasive
/// runtime-tunable hints (Windows process priority, macOS app nap opt-out)
/// after the user toggles a setting.
#[tauri::command]
pub fn apply_perf_hints(app: tauri::AppHandle, high_priority: bool) -> Result<(), String> {
    let _ = app;
    #[cfg(target_os = "windows")]
    unsafe {
        use std::ptr;
        // SetPriorityClass on the current process. We use raw FFI to avoid
        // pulling the `windows` crate just for one call.
        extern "system" {
            fn GetCurrentProcess() -> *mut std::ffi::c_void;
            fn SetPriorityClass(h: *mut std::ffi::c_void, prio: u32) -> i32;
        }
        const HIGH_PRIORITY_CLASS: u32 = 0x00000080;
        const NORMAL_PRIORITY_CLASS: u32 = 0x00000020;
        let prio = if high_priority { HIGH_PRIORITY_CLASS } else { NORMAL_PRIORITY_CLASS };
        let h = GetCurrentProcess();
        if h.is_null() || SetPriorityClass(h, prio) == 0 {
            return Err("SetPriorityClass failed".into());
        }
        let _ = ptr::null::<()>();
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = high_priority;
    }
    Ok(())
}
