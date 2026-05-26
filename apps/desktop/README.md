# Babbage AI — desktop client

Tauri 2.0 wrapper around the Babbage web app. Produces native binaries for
Windows, macOS and Linux Ubuntu from one source tree (~6 MB stripped on
release builds).

## Why Tauri (vs Electron)?

| | Tauri 2.0 | Electron |
|---|---|---|
| Binary size | ~6 MB | ~120 MB |
| Memory | ~50 MB | ~250 MB |
| Renders via | OS native WebView | Bundled Chromium |
| Auto-updater | Built-in | Plugin |

Tauri uses the OS-native WebView (WebView2 on Windows, WKWebView on macOS,
WebKitGTK on Linux), so we ship one tiny Rust binary that loads the hosted
Babbage web app at `https://babagemed.com`.

## Prerequisites

- **Rust** ≥ 1.77 (`rustup install stable`)
- **Node** ≥ 20 (only for `tauri` CLI)
- **OS toolchain:**
  - Windows: Microsoft C++ Build Tools + WebView2 runtime (preinstalled on Win 11)
  - macOS:   Xcode Command-Line Tools (`xcode-select --install`)
  - Ubuntu:  `sudo apt install libwebkit2gtk-4.1-dev build-essential libssl-dev libayatana-appindicator3-dev librsvg2-dev`

## Develop

```bash
# from apps/desktop/
npm install
npm run dev
```

The first compile downloads Rust deps (~3 min on first run, cached after).
The Tauri window auto-reloads on Rust changes.

## Build platform binaries

```bash
npm run build
# outputs land in src-tauri/target/release/bundle/
#   ├─ msi/   Babbage AI_0.1.0_x64.msi      (Windows installer)
#   ├─ nsis/  Babbage AI_0.1.0_x64-setup.exe
#   ├─ dmg/   Babbage AI_0.1.0_aarch64.dmg  (macOS)
#   ├─ macos/ Babbage AI.app
#   ├─ deb/   babbage-ai_0.1.0_amd64.deb    (Ubuntu)
#   └─ appimage/ Babbage AI_0.1.0_amd64.AppImage
```

Cross-compiling is supported but each target needs its toolchain. The
simplest CI path is one GitHub Actions runner per target OS. See the
`.github/workflows/desktop.yml` (TBD).

## Code-signing & notarisation

- Windows: requires a code-signing cert (EV or OV). Wire via
  `tauri.conf.json` → `bundle.windows.certificateThumbprint`.
- macOS: requires Apple Developer ID + notarisation. Wire via
  `APPLE_CERTIFICATE` env + `tauri-action` in CI.
- Linux: no signing required for AppImage/.deb.

## Architecture

```
┌────────────────────────────────────────────┐
│ Tauri shell (Rust, src-tauri/)             │
│   └─ Native WebView (per OS)               │
│        └─ Loads https://babagemed.com      │
│             (the hosted Next.js app)       │
└────────────────────────────────────────────┘
```

The Rust layer exposes one command (`app_info()`) the React frontend can
call via `@tauri-apps/api/core` to detect it's running inside the desktop
shell — useful for swapping web file pickers for native ones, system-tray
behaviour, deep links etc.

## Hardware introspection + perf

The Rust shell now does a lot more than wrap a WebView. It exposes typed
commands to the React layer (see `apps/web/app/lib/desktop.ts`) for:

- `system_snapshot()` — CPU brand + frequency + per-core usage, RAM/swap,
  disks, network interfaces, thermal sensors, OS/host info
- `gpu_adapters()` — every Vulkan/Metal/DX12 adapter (requires the
  `gpu-probe` cargo feature)
- `battery_status()` — charge %, time-to-full/empty, cycle count
  (requires the `battery` cargo feature)
- `secret_set/get/delete()` — native OS keychain (Keychain on macOS,
  Credential Manager on Windows, libsecret on Linux)
- `apply_perf_hints(highPriority)` — bumps Windows process priority class
- `focus_main / toggle_fullscreen / set_always_on_top / request_user_attention`

Performance switches that have to be set BEFORE the WebView starts
(GPU rasterisation, zero-copy, hardware video decode, App Nap opt-out)
are configured in `src-tauri/src/perf.rs` and run before any plugin
registration.

### Built-in plugins

`shell`, `fs`, `dialog`, `os`, `process`, `http`, `notification`,
`clipboard-manager`, `global-shortcut`, `opener`, `store`, `log`,
`updater`, `single-instance`, `deep-link`, `window-state`, `autostart`.

### Build profiles

- `npm run build` — default `release` profile (binary size optimised, ~6 MB)
- `npx tauri build --profile release-fast` — max-perf profile (`opt-level=3`,
  ~12 MB, faster compute-heavy paths)

### Cargo features

| Feature      | Default | What it adds |
|--------------|---------|--------------|
| `gpu-probe`  | off     | wgpu adapter enumeration (~3 MB) |
| `battery`    | off     | Battery introspection on macOS/Linux/Windows |

Enable with `npx tauri build -- --features gpu-probe,battery`.

### System tray + global shortcuts

The app installs a tray icon on launch (right-click for menu, left-click
to focus the main window) and registers `Ctrl/Cmd + Shift + Space` as a
global summon shortcut. The React app listens for `babbage:summon` /
`babbage:new-chat` / `babbage:cli` window events.

### Deep links

The `babbage://` URL scheme is registered with the OS. OAuth flows can
redirect to `babbage://oauth/callback?...` and the desktop window will
focus + dispatch the URL to the React app via the `deep-link` plugin.

### Native keychain

Tokens that the web app would otherwise put in `localStorage` are mirrored
into the OS keychain via `secret_set/get/delete`. The web app should
preferentially read from the keychain when `isDesktop()` is true (see
`apps/web/app/lib/desktop.ts`).

## Roadmap

- [x] Native system tray
- [x] Auto-updater (wired; needs signing key + endpoint)
- [x] Single-instance lock
- [x] Deep links: `babbage://`
- [ ] Native menu bar with web-mirrored keyboard shortcuts
- [ ] Push notifications (background channel)
- [ ] Code-signing CI secrets actually filled in
