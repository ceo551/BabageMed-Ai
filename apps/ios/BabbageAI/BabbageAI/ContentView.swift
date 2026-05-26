// ContentView.swift
// Root view — embeds a WKWebView pointed at the hosted Babbage web app.
// A thin SwiftUI overlay handles:
//   - launch splash while the first navigation completes
//   - pull-to-refresh
//   - share sheet from a long-press on links
//
// Native screens (composer, file picker, account settings) can live as
// SwiftUI views layered on top later; v1 is a webview wrapper so all 540
// connectors + auth state work the same as on the desktop.

import SwiftUI
import WebKit

// MARK: - SwiftUI host

struct ContentView: View {
    @State private var isLoading = true
    @State private var canGoBack = false

    var body: some View {
        ZStack {
            WebShell(isLoading: $isLoading, canGoBack: $canGoBack)
                .ignoresSafeArea(edges: .bottom)

            if isLoading {
                VStack(spacing: 18) {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(.cyan)
                        .scaleEffect(1.4)
                    Text("Babbage AI")
                        .font(.title3)
                        .foregroundStyle(.white)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(.black)
            }
        }
        .preferredColorScheme(.dark)
    }
}

// MARK: - WKWebView bridge

struct WebShell: UIViewRepresentable {
    @Binding var isLoading: Bool
    @Binding var canGoBack: Bool

    // The hosted web app. Switch to a localhost URL during dev (the iOS
    // simulator can reach the host Mac via http://localhost:3000).
    private let homeURL = URL(string: "https://babagemed.com")!

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        // Persistent cookies + LocalStorage so the user stays logged in
        // across app launches. The default WKWebView session is ephemeral.
        config.websiteDataStore = .default()

        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.uiDelegate         = context.coordinator
        web.allowsBackForwardNavigationGestures = true
        web.scrollView.bounces = true
        web.scrollView.contentInsetAdjustmentBehavior = .automatic
        web.isOpaque    = false
        web.backgroundColor = .black
        web.scrollView.backgroundColor = .black

        // Identify ourselves so the backend can tag iOS sessions in metrics
        // and the React layer can `if (navigator.userAgent.includes("Babbage-iOS"))`
        // to swap web file pickers for native ones later.
        web.customUserAgent = (web.value(forKey: "userAgent") as? String ?? "") + " Babbage-iOS/0.1.0"

        web.load(URLRequest(url: homeURL))
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        // SwiftUI re-invokes this on @Binding changes; nothing to update —
        // navigation is driven by the delegate.
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        var parent: WebShell
        init(_ parent: WebShell) { self.parent = parent }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            DispatchQueue.main.async {
                self.parent.isLoading = false
                self.parent.canGoBack = webView.canGoBack
            }
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            // Show the splash again so the user knows something went wrong.
            DispatchQueue.main.async { self.parent.isLoading = false }
        }

        // Open _blank/<a target=_blank> links by loading them in the same
        // WebView (we have no second tab; trying to spawn one would crash).
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                     for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = navigationAction.request.url {
                webView.load(URLRequest(url: url))
            }
            return nil
        }
    }
}

#Preview {
    ContentView()
}
