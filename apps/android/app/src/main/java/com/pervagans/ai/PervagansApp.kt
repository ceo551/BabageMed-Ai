// Application entrypoint — singleton instance lives for the whole process.
// Keep this small; resource initialisation belongs in the activity unless it
// MUST happen before any UI shows (analytics SDKs, crash reporting, etc.).
package com.pervagans.ai

import android.app.Application
import android.webkit.WebView

class PervagansApp : Application() {
    override fun onCreate() {
        super.onCreate()
        // Enables Chrome DevTools remote inspection in debug builds so we
        // can debug the WebView from chrome://inspect on the host machine.
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
    }
}
