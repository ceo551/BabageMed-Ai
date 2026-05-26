# Babbage AI — iOS

Native iOS app: SwiftUI shell that mounts a WKWebView pointed at the
hosted Babbage web app. Targets iOS 16+ (NavigationStack + new App lifecycle).

## Architecture

```
SwiftUI App (BabbageAIApp)
   └─ ContentView
        └─ WebShell (UIViewRepresentable → WKWebView)
             └─ https://babagemed.com
```

All 540 connectors, the 8 feature workspaces, auth, billing — everything
the web app does works here automatically. v1 is a wrapper; native screens
(file picker, voice recorder, share extensions) layer in as we go.

## Prerequisites

- macOS Sonoma+ (Xcode 15+ only runs on macOS)
- Xcode 15.0+
- Apple Developer account (for device deployment / App Store)

## Build & run

```bash
# Open the project in Xcode:
open apps/ios/BabbageAI/BabbageAI.xcodeproj

# Or from the command line (simulator):
xcodebuild \
  -project apps/ios/BabbageAI/BabbageAI.xcodeproj \
  -scheme BabbageAI \
  -destination 'platform=iOS Simulator,name=iPhone 15 Pro' \
  build
```

For device builds you need to add your Team in **Signing & Capabilities**
and configure a unique `PRODUCT_BUNDLE_IDENTIFIER` (default
`com.babbage.ai.ios`).

## File map

- `BabbageAIApp.swift` — `@main` entry point (SwiftUI scene)
- `ContentView.swift` — root view + WKWebView shell
- `Info.plist` — bundle metadata, ATS exceptions, camera/mic/location
  permission strings, universal-link domain (`babagemed.com`)
- `Assets.xcassets/AppIcon.appiconset/` — drop a 1024×1024 PNG named
  `icon-1024.png` here before App Store submission
- `Assets.xcassets/AccentColor.colorset/` — system tint colour (cyan)

## Project file

The `BabbageAI.xcodeproj/project.pbxproj` is generated lazily on first
Xcode open. Two ways to (re)create it:

1. **Xcode UI** — File → New → Project → iOS → App, set "Product Name"
   to `BabbageAI`, "Interface" to SwiftUI, language Swift, then drag the
   four `.swift`/`.plist` files into the new project.
2. **xcodegen** (recommended for reproducible builds) — install
   [xcodegen](https://github.com/yonaskolb/XcodeGen) and run:
   ```bash
   cd apps/ios/BabbageAI
   xcodegen generate
   ```
   The `project.yml` definition lives at the root of `apps/ios/BabbageAI/`.

## Universal links

`Info.plist` declares `applinks:babagemed.com`. To make
`https://babagemed.com/...` open in the app when installed, publish an
AASA file at `https://babagemed.com/.well-known/apple-app-site-association`:

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["TEAMID.com.babbage.ai.ios"],
        "components": [{ "/": "/*" }]
      }
    ]
  }
}
```

Replace `TEAMID` with your Apple Developer team prefix.

## Roadmap

- [ ] Native composer overlay (SwiftUI sheet with TextField + Speech.framework dictation)
- [ ] Native file picker via UIDocumentPickerViewController
- [ ] Share extension (let users send PDFs into a feature from any app)
- [ ] Push notifications via APNs
- [ ] Sign in with Apple
