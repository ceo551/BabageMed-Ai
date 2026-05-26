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

## Roadmap

- [ ] Native system tray (`tauri-plugin-tray`)
- [ ] Auto-updater (`tauri-plugin-updater`)
- [ ] Single-instance lock so a second launch focuses the existing window
- [ ] Deep links: `babbage://` URL scheme for OAuth callbacks
- [ ] Native menu bar with keyboard shortcuts mirrored from the web app
