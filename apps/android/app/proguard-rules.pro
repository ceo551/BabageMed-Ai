# ProGuard / R8 — applied to release builds only (isMinifyEnabled = true).
#
# WebView callbacks: R8 strips classes referenced only via reflection, so
# every @JavascriptInterface method must survive the obfuscation pass.
# Add explicit keep rules here if you wire bridges from MainActivity.

-keep class * extends androidx.webkit.WebViewClient { *; }
-keep class * extends androidx.webkit.WebChromeClient { *; }

# Kotlin metadata for reflective callers.
-keep class kotlin.Metadata { *; }
