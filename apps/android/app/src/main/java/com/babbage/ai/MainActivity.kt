// MainActivity.kt
//
// Single-activity app: a full-bleed WebView wrapped in a Compose scaffold
// so we can mix native overlays later (bottom sheet for file picker,
// dialog for OAuth, etc.). v1 is just the WebView pointed at the hosted
// Babbage web app.

package com.babbage.ai

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowCompat

class MainActivity : ComponentActivity() {

    // Permission launchers — invoked when the WebView page requests camera,
    // mic, or geolocation. Compose's rememberLauncherForActivityResult would
    // be cleaner but we wire it via the platform API so the WebChromeClient
    // callbacks can grant/deny synchronously.
    private val pendingPermissions = mutableMapOf<Int, PermissionRequest>()

    private val multiplePermissions = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { granted ->
        val request = pendingPermissions.remove(REQUEST_PERM_ID) ?: return@registerForActivityResult
        val allowed = request.resources.filter { res ->
            when (res) {
                PermissionRequest.RESOURCE_VIDEO_CAPTURE -> granted[Manifest.permission.CAMERA] == true
                PermissionRequest.RESOURCE_AUDIO_CAPTURE -> granted[Manifest.permission.RECORD_AUDIO] == true
                else -> true
            }
        }.toTypedArray()
        if (allowed.isNotEmpty()) request.grant(allowed) else request.deny()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        setContent { BabbageTheme { Root() } }
    }

    @Composable
    private fun Root() {
        var loading by remember { mutableStateOf(true) }
        Surface(modifier = Modifier.fillMaxSize(), color = Color.Black) {
            Box(modifier = Modifier.fillMaxSize()) {
                AndroidView(
                    factory = { ctx ->
                        WebView(ctx).apply {
                            layoutParams = ViewGroup.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT,
                            )
                            setBackgroundColor(android.graphics.Color.BLACK)
                            configureSettings(this.settings)
                            webViewClient = AppWebViewClient(
                                onFinished = { loading = false },
                                onStarted  = { evaluateJavascript(NativeBridge.BOOTSTRAP_JS, null) },
                            )
                            webChromeClient = AppChromeClient()
                            // Identify ourselves so server logs + the React
                            // layer can detect the Android shell.
                            settings.userAgentString = settings.userAgentString + " Babbage-Android/0.1.0"

                            // Wire the JS↔Kotlin bridge BEFORE loadUrl so
                            // the injected globals are visible on first paint.
                            addJavascriptInterface(
                                NativeBridge(this@MainActivity, this),
                                NativeBridge.NAME,
                            )

                            // Load the hosted app. For local dev, point this
                            // at the emulator-facing host IP: 10.0.2.2:3000.
                            loadUrl(HOME_URL)
                        }
                    },
                    update = { /* nothing — webview owns its own state */ },
                )

                if (loading) {
                    Box(
                        modifier = Modifier.fillMaxSize().background(Color.Black),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator(color = Color(0xFF22D3EE))
                    }
                }
            }
        }
    }

    private fun configureSettings(s: WebSettings) {
        s.javaScriptEnabled                = true
        s.domStorageEnabled                = true
        s.databaseEnabled                  = true
        s.loadWithOverviewMode             = true
        s.useWideViewPort                  = true
        s.allowFileAccess                  = false
        s.allowContentAccess               = false
        s.mediaPlaybackRequiresUserGesture = false
        s.mixedContentMode                 = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        s.cacheMode                        = WebSettings.LOAD_DEFAULT
    }

    private inner class AppWebViewClient(
        private val onFinished: () -> Unit,
        private val onStarted: WebView.() -> Unit = {},
    ) : WebViewClient() {
        override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
            super.onPageStarted(view, url, favicon)
            view?.onStarted()
        }

        override fun onPageFinished(view: WebView?, url: String?) {
            super.onPageFinished(view, url)
            // Re-inject after every navigation in case the SPA swapped
            // documents (e.g. OAuth redirect chain ending back at the app).
            view?.evaluateJavascript(NativeBridge.BOOTSTRAP_JS, null)
            onFinished()
        }

        override fun shouldOverrideUrlLoading(
            view: WebView?,
            request: WebResourceRequest?,
        ): Boolean {
            // External (non-babagemed) URLs spin out to the system browser
            // so OAuth callbacks etc. don't leave the WebView trapped on a
            // third-party site.
            val url = request?.url ?: return false
            val host = url.host ?: return false
            if (host.endsWith("babagemed.com")) return false
            try {
                startActivity(Intent(Intent.ACTION_VIEW, url))
            } catch (_: Exception) { /* no browser installed */ }
            return true
        }
    }

    private inner class AppChromeClient : WebChromeClient() {
        override fun onPermissionRequest(request: PermissionRequest) {
            // Convert WebView permission codes into Android runtime perms.
            val needed = mutableListOf<String>()
            for (r in request.resources) {
                when (r) {
                    PermissionRequest.RESOURCE_VIDEO_CAPTURE -> needed += Manifest.permission.CAMERA
                    PermissionRequest.RESOURCE_AUDIO_CAPTURE -> needed += Manifest.permission.RECORD_AUDIO
                }
            }
            if (needed.isEmpty()) {
                request.grant(request.resources)
                return
            }
            pendingPermissions[REQUEST_PERM_ID] = request
            multiplePermissions.launch(needed.toTypedArray())
        }
    }

    companion object {
        const val HOME_URL = "https://babagemed.com"
        const val REQUEST_PERM_ID = 1001
    }
}

@Composable
private fun BabbageTheme(content: @Composable () -> Unit) {
    val scheme = darkColorScheme(
        primary       = Color(0xFF22D3EE),
        background    = Color(0xFF0A0A0C),
        surface       = Color(0xFF0A0A0C),
        onBackground  = Color.White,
        onSurface     = Color.White,
    )
    MaterialTheme(colorScheme = scheme, content = content)
}
