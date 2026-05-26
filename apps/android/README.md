# Babbage AI — Android

Single-activity Compose + WebView shell pointed at the hosted Babbage web
app (`https://babagemed.com`). Targets Android 7.0 (API 24)+ which covers
~96% of in-market devices.

## Architecture

```
Activity (MainActivity)
   └─ Compose Surface
        └─ AndroidView { WebView }
             └─ https://babagemed.com
```

All 540 connectors, the 8 feature workspaces, auth, billing — work the
same as on the web because they ARE the web. v1 is a shell; native
overlays (file picker, voice, share intent receivers) layer in as we go.

## Prerequisites

- Android Studio Iguana (2023.2.1)+
- JDK 17 (bundled with recent Android Studio)
- Android SDK 34, Build-Tools 34.0.0
- One physical device on USB-debug or an emulator (API 30+ recommended)

## Build & run

```bash
# From apps/android/
./gradlew :app:installDebug
adb shell am start -n com.babbage.ai.debug/com.babbage.ai.MainActivity
```

Or open `apps/android/` in Android Studio: File → Open → pick the folder,
then Run ▶.

For dev against a local backend, change `MainActivity.HOME_URL` to
`http://10.0.2.2:3000` (the emulator's host loopback alias) and add
`android:usesCleartextTraffic="true"` temporarily to the `<application>`
manifest tag.

## Release build

```bash
./gradlew :app:assembleRelease
# Outputs:
#   app/build/outputs/apk/release/app-release-unsigned.apk
#   app/build/outputs/bundle/release/app-release.aab   (for Play Store upload)
```

Wire signing in `app/build.gradle.kts` → add a `signingConfigs { release {...} }`
block and reference it from `buildTypes.release`. Keep the keystore + passwords
OUT of the repo (use `~/.gradle/gradle.properties` or CI secrets).

## App Links

The manifest declares an `<intent-filter android:autoVerify="true">` for
`https://babagemed.com`. To make the system route those URLs to the app:

1. Get the app's SHA-256 fingerprint:
   ```bash
   keytool -list -v -keystore <your-keystore> -alias <alias> | grep "SHA256"
   ```
2. Publish `/.well-known/assetlinks.json` at babagemed.com:
   ```json
   [{
     "relation": ["delegate_permission/common.handle_all_urls"],
     "target": {
       "namespace": "android_app",
       "package_name": "com.babbage.ai",
       "sha256_cert_fingerprints": ["<paste fingerprint>"]
     }
   }]
   ```
3. Re-install the app — Android automatically re-verifies on next launch.

## File map

- `settings.gradle.kts`, `build.gradle.kts` — Gradle setup
- `app/build.gradle.kts` — module config (Compose, Material3, WebView)
- `app/src/main/AndroidManifest.xml` — permissions, app links, theme
- `app/src/main/java/com/babbage/ai/MainActivity.kt` — root activity
- `app/src/main/java/com/babbage/ai/BabbageApp.kt` — Application class
- `app/src/main/res/values/{strings,themes}.xml` — name + dark theme
- `app/src/main/res/xml/{backup_rules,data_extraction_rules}.xml` — no auto-backup
- `app/proguard-rules.pro` — R8 keep rules

## Roadmap

- [ ] App icon (mipmap PNGs at 48/72/96/144/192 dp + adaptive icon)
- [ ] Native share intent receiver (PDFs into a feature)
- [ ] FCM push notifications
- [ ] Google sign-in via Credential Manager
