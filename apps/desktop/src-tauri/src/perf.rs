// Pre-init performance/hardware-acceleration switches. Several of these
// MUST be set as env vars before Tauri spawns its WebView — once the
// WebView2/WebKitGTK process is running they are read-only. We set
// safe defaults but a power user can override any of them via the OS
// environment.

use std::env;

fn ensure(key: &str, value: &str) {
    if env::var_os(key).is_none() {
        // SAFETY: single-threaded at this point (called before
        // tauri::Builder::default()).
        env::set_var(key, value);
    }
}

pub fn install_pre_init_env() {
    // ── Windows / WebView2 ─────────────────────────────────────────────
    // Force GPU compositing, hardware H264, and the Skia-Vulkan backend
    // when an Nvidia/AMD GPU is present. WebView2 honours the same
    // chromium switches Chrome uses, comma-separated.
    #[cfg(target_os = "windows")]
    // --ignore-gpu-blocklist deliberately left out: Chromium maintains
    // that blocklist for specific driver bugs that cause data corruption
    // or crashes; overriding it can produce wrong-pixel reads from one
    // site into another. We accept the cost of slightly worse perf on
    // blocklisted drivers (fallback to software composite) for the
    // security guarantee.
    ensure(
        "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
        concat!(
            "--enable-gpu-rasterization ",
            "--enable-zero-copy ",
            "--enable-accelerated-video-decode ",
            "--enable-features=UseSkiaRenderer,CanvasOopRasterization ",
            "--use-angle=d3d11"
        ),
    );

    // ── Linux / WebKitGTK ──────────────────────────────────────────────
    // WebKitGTK reads these to enable GPU compositing on systems where
    // glx/egl is available. Without these the WebView falls back to
    // software rendering on many distros (Ubuntu 22.04 default).
    #[cfg(target_os = "linux")]
    {
        ensure("WEBKIT_FORCE_COMPOSITING_MODE", "1");
        ensure("WEBKIT_DISABLE_DMABUF_RENDERER", "0");
        ensure("WEBKIT_DISABLE_COMPOSITING_MODE", "0");
        // WGL fallback on hybrid GPU laptops (Optimus). Most users on
        // Wayland want NVIDIA's egl-wayland path.
        ensure("__GLX_VENDOR_LIBRARY_NAME", "");
        // GStreamer hardware decode (vaapi). Helps video <video> playback
        // in the WebView use the GPU instead of CPU.
        ensure("GST_VAAPI_ALL_DRIVERS", "1");
    }

    // ── Generic ────────────────────────────────────────────────────────
    // Tokio's blocking pool defaults to 512 threads; cap at 4x logical
    // cores to keep memory pressure sane on machines with hundreds of
    // logical CPUs.
    let blocking = (num_cpus::get() * 4).max(8).to_string();
    ensure("TOKIO_WORKER_THREADS", &num_cpus::get().to_string());
    ensure("TOKIO_BLOCKING_THREADS", &blocking);
}
