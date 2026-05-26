// NativeBridge.swift
// JS ↔ Swift bridge for the Babbage iOS shell. Exposes a global
// `BabbageNative` object inside the WKWebView so the React app at
// https://babagemed.com can call into iOS — share sheet, file picker,
// FaceID/TouchID, haptics, local notifications.
//
// Wiring is symmetric with apps/android/.../NativeBridge.kt and the
// `native()` helper in apps/web/app/lib/desktop.ts.

import Foundation
import LocalAuthentication
import UIKit
import UserNotifications
import WebKit
import UniformTypeIdentifiers

final class NativeBridge: NSObject, WKScriptMessageHandlerWithReply {
    static let name = "BabbageNative"

    /// Injected at document-start so `window.BabbageNative` is defined
    /// before the React bundle runs.
    static var userScript: WKUserScript {
        let js = """
        (function() {
          const post = (action, payload) =>
            window.webkit.messageHandlers.\(Self.name).postMessage({ action, payload });
          window.BabbageNative = {
            platform: "ios",
            shareText:   (text)       => post("shareText",   { text }),
            haptic:      (pattern)    => post("haptic",      { pattern }),
            notify:      (title, body)=> post("notify",      { title, body }),
            pickFile:    (mime)       => post("pickFile",    { mime }),
            authenticate:(reason)     => post("authenticate",{ reason }),
            openSettings:()           => post("openSettings",{}),
          };
        })();
        """
        return WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true)
    }

    weak var hostController: UIViewController?

    // MARK: - WKScriptMessageHandlerWithReply

    func userContentController(_ userContentController: WKUserContentController,
                                didReceive message: WKScriptMessage,
                                replyHandler: @escaping (Any?, String?) -> Void) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else {
            replyHandler(nil, "bad payload")
            return
        }
        let payload = (body["payload"] as? [String: Any]) ?? [:]
        switch action {
        case "shareText":   shareText(payload, reply: replyHandler)
        case "haptic":      haptic(payload, reply: replyHandler)
        case "notify":      notify(payload, reply: replyHandler)
        case "pickFile":    pickFile(payload, reply: replyHandler)
        case "authenticate":authenticate(payload, reply: replyHandler)
        case "openSettings":openSettings(reply: replyHandler)
        default:            replyHandler(nil, "unknown action: \(action)")
        }
    }

    // MARK: - Handlers

    private func shareText(_ payload: [String: Any], reply: @escaping (Any?, String?) -> Void) {
        guard let text = payload["text"] as? String, let host = hostController else {
            reply(nil, "missing text")
            return
        }
        DispatchQueue.main.async {
            let av = UIActivityViewController(activityItems: [text], applicationActivities: nil)
            av.popoverPresentationController?.sourceView = host.view
            host.present(av, animated: true) { reply(true, nil) }
        }
    }

    private func haptic(_ payload: [String: Any], reply: @escaping (Any?, String?) -> Void) {
        let pattern = (payload["pattern"] as? String) ?? "light"
        DispatchQueue.main.async {
            let gen: UIImpactFeedbackGenerator
            switch pattern {
            case "heavy":  gen = UIImpactFeedbackGenerator(style: .heavy)
            case "medium": gen = UIImpactFeedbackGenerator(style: .medium)
            default:       gen = UIImpactFeedbackGenerator(style: .light)
            }
            gen.prepare()
            gen.impactOccurred()
            reply(true, nil)
        }
    }

    // Notifications: check current authorization first. Requesting on
    // every call re-prompts on every iOS launch where the user is
    // undecided, and on permanent-denied silently fails forever.
    private func notify(_ payload: [String: Any], reply: @escaping (Any?, String?) -> Void) {
        let title = (payload["title"] as? String) ?? "Babbage AI"
        let body  = (payload["body"]  as? String) ?? ""
        let center = UNUserNotificationCenter.current()
        center.getNotificationSettings { settings in
            let post: () -> Void = {
                let content = UNMutableNotificationContent()
                content.title = title
                content.body  = body
                content.sound = .default
                let req = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
                center.add(req) { e in
                    DispatchQueue.main.async {
                        if let e { reply(nil, e.localizedDescription) } else { reply(true, nil) }
                    }
                }
            }
            switch settings.authorizationStatus {
            case .authorized, .provisional, .ephemeral:
                post()
            case .notDetermined:
                center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, err in
                    if granted && err == nil { post() }
                    else {
                        DispatchQueue.main.async { reply(false, err?.localizedDescription ?? "denied") }
                    }
                }
            default:
                DispatchQueue.main.async { reply(false, "notifications denied") }
            }
        }
    }

    private func authenticate(_ payload: [String: Any], reply: @escaping (Any?, String?) -> Void) {
        let reason = (payload["reason"] as? String) ?? "Authenticate to continue"
        let ctx = LAContext()
        var err: NSError?
        guard ctx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &err) else {
            reply(false, err?.localizedDescription ?? "biometrics unavailable")
            return
        }
        ctx.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { ok, e in
            reply(ok, e?.localizedDescription)
        }
    }

    private func openSettings(reply: @escaping (Any?, String?) -> Void) {
        guard let url = URL(string: UIApplication.openSettingsURLString) else {
            reply(nil, "no settings url")
            return
        }
        DispatchQueue.main.async {
            UIApplication.shared.open(url, options: [:]) { ok in reply(ok, nil) }
        }
    }

    // File-picker: punts to UIDocumentPickerViewController. The picked file
    // is returned to JS as a data: URL so the React app can upload it
    // through the existing chat-attachment flow without needing a
    // separate native upload pipe.
    private var filePickerReply: ((Any?, String?) -> Void)?

    private func pickFile(_ payload: [String: Any], reply: @escaping (Any?, String?) -> Void) {
        // Refuse overlapping picks. A second pickFile while one is in
        // flight previously dropped the first reply and left its JS
        // Promise hanging forever.
        guard filePickerReply == nil else {
            reply(nil, "another pickFile call is in flight")
            return
        }
        guard let host = hostController else { reply(nil, "no host"); return }
        let mime = (payload["mime"] as? String) ?? "*/*"
        let types: [UTType] = {
            if mime == "*/*" { return [.data] }
            if let t = UTType(mimeType: mime) { return [t] }
            return [.data]
        }()
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: types, asCopy: true)
        picker.allowsMultipleSelection = false
        picker.delegate = self
        filePickerReply = reply
        DispatchQueue.main.async { host.present(picker, animated: true) }
    }
}

private let maxPickedFileBytes: Int64 = 10 * 1024 * 1024

extension NativeBridge: UIDocumentPickerDelegate {
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        let reply = filePickerReply
        filePickerReply = nil
        guard let url = urls.first else { reply?(nil, nil); return }
        do {
            // Size-gate BEFORE reading. Loading a 500 MB pick into memory
            // and then base64-inflating it 33% would OOM-kill the app.
            let attrs = try FileManager.default.attributesOfItem(atPath: url.path)
            let size = (attrs[.size] as? NSNumber)?.int64Value ?? 0
            if size > maxPickedFileBytes {
                reply?(nil, "file too large (\(size) bytes; max \(maxPickedFileBytes))")
                return
            }
            // Encode off the main thread so the picker UI doesn't hitch
            // while we base64 a multi-MB file.
            DispatchQueue.global(qos: .userInitiated).async {
                do {
                    let data = try Data(contentsOf: url)
                    let mime = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
                    let b64 = data.base64EncodedString()
                    DispatchQueue.main.async {
                        reply?(["name": url.lastPathComponent, "mime": mime, "dataUrl": "data:\(mime);base64,\(b64)"], nil)
                    }
                } catch {
                    DispatchQueue.main.async { reply?(nil, error.localizedDescription) }
                }
            }
        } catch {
            reply?(nil, error.localizedDescription)
        }
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        let reply = filePickerReply
        filePickerReply = nil
        reply?(nil, nil)
    }
}
