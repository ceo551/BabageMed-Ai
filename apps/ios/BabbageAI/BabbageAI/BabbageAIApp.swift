// BabbageAIApp.swift
// Entry point for the iOS app. SwiftUI scene that mounts the WKWebView
// shell at first launch. iOS 16+ (required for NavigationStack and the
// new App lifecycle).

import SwiftUI

@main
struct BabbageAIApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                // The web app expects a dark background underneath the
                // safe area on iPhones with notches — without this iOS
                // paints white above the WebView while it loads.
                .background(Color.black.ignoresSafeArea())
        }
    }
}
