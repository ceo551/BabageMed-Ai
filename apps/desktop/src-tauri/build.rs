// build.rs — invoked by cargo before each compile. Tauri's build script
// generates the platform-specific manifests (.rc on Windows, .desktop
// entry on Linux) from tauri.conf.json + injects the commands declared
// via tauri::generate_handler! into the bundle.
fn main() {
    tauri_build::build()
}
