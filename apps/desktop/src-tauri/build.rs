// build.rs — invoked by cargo before each compile. Tauri's build script
// generates the Windows .rc manifest from tauri.conf.json + injects the
// commands declared via tauri::generate_handler! into the bundle.
fn main() {
    tauri_build::build()
}
