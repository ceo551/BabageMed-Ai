// NativeBridge.kt
// JS ↔ Kotlin bridge for the Pervagans Android shell. Exposes a global
// `PervagansNative` object inside the WebView so the React app at
// https://babagemed.com can call into Android — share sheet, file picker,
// biometric prompt, haptics, system notifications.
//
// Mirrors the `native()` helper in apps/web/app/lib/desktop.ts.

package com.pervagans.ai

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.util.concurrent.Executor

class NativeBridge(
    private val activity: ComponentActivity,
    private val webView: WebView,
) {
    companion object {
        const val NAME = "PervagansNativeRaw"
        const val CHANNEL_ID = "pervagans-default"
        // Injected at page load so the React layer can call PervagansNative.*
        // with a promise-returning API instead of fire-and-forget @JavascriptInterface
        // calls. The pendingCallbacks map round-trips a request id between JS and
        // Kotlin so each native call resolves the right Promise.
        const val BOOTSTRAP_JS: String = """
            (function() {
              if (window.PervagansNative) return;
              const raw = window.$NAME;
              const pending = new Map();
              let nextId = 1;
              window.__pervagansResolve = function(id, ok, value, error) {
                const p = pending.get(id);
                if (!p) return;
                pending.delete(id);
                if (ok) p.resolve(value);
                else    p.reject(new Error(error || "native error"));
              };
              const call = (action, payload) => new Promise((resolve, reject) => {
                const id = nextId++;
                pending.set(id, { resolve, reject });
                raw.dispatch(id, action, JSON.stringify(payload || {}));
              });
              window.PervagansNative = {
                platform: "android",
                shareText:    (text)        => call("shareText",    { text }),
                haptic:       (pattern)     => call("haptic",       { pattern }),
                notify:       (title, body) => call("notify",       { title, body }),
                pickFile:     (mime)        => call("pickFile",     { mime }),
                authenticate: (reason)      => call("authenticate", { reason }),
                openSettings: ()            => call("openSettings", {}),
              };
            })();
        """
    }

    private val main = Handler(Looper.getMainLooper())
    private val executor: Executor = ContextCompat.getMainExecutor(activity)

    // Pending file-picker request id (set when JS calls pickFile, consumed
    // when the document picker activity returns).
    private var pickingId: Int = 0
    // Cap file picker payloads at 10 MiB. Loading the whole file into
    // RAM + base64-encoding it (inflating ~33%) used to OOM the app on
    // multi-hundred-MB picks and ANR the main thread on smaller ones.
    // Anything larger should go through a streaming upload via the
    // web-side fetch with the URI handed back as a content:// URL.
    private val maxFilePickBytes = 10 * 1024 * 1024
    private val docPicker: ActivityResultLauncher<String> =
        activity.registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
            val id = pickingId
            pickingId = 0
            if (id == 0) return@registerForActivityResult
            if (uri == null) {
                resolve(id, null)
                return@registerForActivityResult
            }
            try {
                // Probe the size first via OpenableColumns.SIZE; bail
                // before reading anything if it's over the cap.
                var size: Long = -1
                activity.contentResolver.query(uri, arrayOf(android.provider.OpenableColumns.SIZE), null, null, null)?.use { c ->
                    if (c.moveToFirst()) size = c.getLong(0)
                }
                if (size > maxFilePickBytes) {
                    reject(id, "file too large (${size} bytes; max ${maxFilePickBytes})")
                    return@registerForActivityResult
                }
                val data = activity.contentResolver.openInputStream(uri)?.use { input ->
                    val out = java.io.ByteArrayOutputStream()
                    val buf = ByteArray(64 * 1024)
                    var total = 0L
                    while (true) {
                        val n = input.read(buf)
                        if (n <= 0) break
                        total += n
                        if (total > maxFilePickBytes) {
                            reject(id, "file too large")
                            return@registerForActivityResult
                        }
                        out.write(buf, 0, n)
                    }
                    out.toByteArray()
                } ?: ByteArray(0)
                val mime = activity.contentResolver.getType(uri) ?: "application/octet-stream"
                val b64 = Base64.encodeToString(data, Base64.NO_WRAP)
                val name = uri.lastPathSegment ?: "file"
                val obj = JSONObject().apply {
                    put("name", name)
                    put("mime", mime)
                    put("dataUrl", "data:$mime;base64,$b64")
                }
                resolve(id, obj)
            } catch (t: Throwable) {
                reject(id, t.message ?: "read error")
            }
        }

    init {
        ensureChannel()
    }

    @JavascriptInterface
    fun dispatch(id: Int, action: String, jsonPayload: String) {
        // Always hop to the main thread — every Android UI API we call
        // requires it.
        main.post {
            try {
                // Origin check: addJavascriptInterface attaches this object
                // to ALL frames in the WebView. An iframe loaded from a
                // third-party CDN, an OAuth redirect on an attacker's
                // domain, or a compromised script could otherwise call
                // PervagansNativeRaw.dispatch(...). Reject any frame whose
                // origin isn't on our allow-list.
                val currentUrl = webView.url ?: ""
                val host = try { android.net.Uri.parse(currentUrl).host ?: "" } catch (_: Throwable) { "" }
                val originAllowed = host == "babagemed.com" || host.endsWith(".babagemed.com") || currentUrl.startsWith("http://10.0.2.2:") // emulator dev
                if (!originAllowed) {
                    reject(id, "origin not allowed")
                    return@post
                }
                val payload = JSONObject(jsonPayload)
                when (action) {
                    "shareText"    -> shareText(id, payload)
                    "haptic"       -> haptic(id, payload)
                    "notify"       -> notify(id, payload)
                    "pickFile"     -> pickFile(id, payload)
                    "authenticate" -> authenticate(id, payload)
                    "openSettings" -> openSettings(id)
                    else           -> reject(id, "unknown action: $action")
                }
            } catch (t: Throwable) {
                reject(id, t.message ?: "dispatch error")
            }
        }
    }

    // MARK: - Handlers

    private fun shareText(id: Int, payload: JSONObject) {
        val text = payload.optString("text")
        if (text.isEmpty()) {
            reject(id, "text required")
            return
        }
        // Android's IPC bundles cap at ~1 MiB; oversized text crashes
        // the share sheet with TransactionTooLargeException. Cap at 256
        // KiB — any reasonable share fits.
        if (text.length > 256 * 1024) {
            reject(id, "text too large")
            return
        }
        try {
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, text)
            }
            activity.startActivity(Intent.createChooser(intent, null).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            })
            resolve(id, true)
        } catch (t: Throwable) {
            reject(id, t.message ?: "share failed")
        }
    }

    private fun haptic(id: Int, payload: JSONObject) {
        val pattern = payload.optString("pattern", "light")
        val ms = when (pattern) { "heavy" -> 40L; "medium" -> 20L; else -> 10L }
        val v: Vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (activity.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            activity.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
        v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE))
        resolve(id, true)
    }

    private fun notify(id: Int, payload: JSONObject) {
        val title = payload.optString("title", "Pervagans AI")
        val body  = payload.optString("body", "")
        val n = NotificationCompat.Builder(activity, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .build()
        try {
            NotificationManagerCompat.from(activity).notify((System.currentTimeMillis() % Int.MAX_VALUE).toInt(), n)
            resolve(id, true)
        } catch (t: SecurityException) {
            // POST_NOTIFICATIONS not granted on API 33+.
            reject(id, "notification permission denied")
        }
    }

    private fun pickFile(id: Int, payload: JSONObject) {
        if (pickingId != 0) {
            reject(id, "another pickFile call is already in flight")
            return
        }
        pickingId = id
        val mime = payload.optString("mime", "*/*").ifBlank { "*/*" }
        docPicker.launch(mime)
    }

    private fun authenticate(id: Int, payload: JSONObject) {
        val reason = payload.optString("reason", "Authenticate to continue")
        val canAuth = BiometricManager.from(activity)
            .canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL)
        if (canAuth != BiometricManager.BIOMETRIC_SUCCESS) {
            reject(id, "biometrics unavailable ($canAuth)")
            return
        }
        val prompt = BiometricPrompt(activity, executor, object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                resolve(id, true)
            }
            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                reject(id, errString.toString())
            }
            override fun onAuthenticationFailed() {
                // user-recoverable; don't reject — let BiometricPrompt retry.
            }
        })
        val info = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Pervagans AI")
            .setSubtitle(reason)
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL)
            .build()
        prompt.authenticate(info)
    }

    private fun openSettings(id: Int) {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.fromParts("package", activity.packageName, null)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        activity.startActivity(intent)
        resolve(id, true)
    }

    // MARK: - Plumbing

    private fun resolve(id: Int, value: Any?) {
        val js = "window.__pervagansResolve(${id}, true, ${toJs(value)}, null)"
        webView.post { webView.evaluateJavascript(js, null) }
    }

    private fun reject(id: Int, error: String) {
        // JSONObject.quote handles all the cases the ad-hoc string-replace
        // version missed: \n, \r, \t, U+2028, U+2029, etc.
        val js = "window.__pervagansResolve(${id}, false, null, ${JSONObject.quote(error)})"
        webView.post { webView.evaluateJavascript(js, null) }
    }

    private fun toJs(value: Any?): String = when (value) {
        null         -> "null"
        is Boolean   -> value.toString()
        is Number    -> value.toString()
        is JSONObject -> value.toString()
        // Use JSONObject.quote for safe string serialisation.
        else         -> JSONObject.quote(value.toString())
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = activity.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Pervagans AI", NotificationManager.IMPORTANCE_DEFAULT),
        )
    }
}
