"use client";

import React from "react";

// Catches render-time crashes inside the app shell so a thrown error in
// one route (e.g. an LLM response that breaks the markdown renderer)
// doesn't blank the entire page. Falls back to a small recoverable card
// with a reload button. The reset prop lets parent routes re-mount the
// boundary's children when navigation succeeds elsewhere — keys it off
// the current pathname so a successful tab switch clears prior errors.
type State = { err: Error | null };

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; resetKey?: string },
  State
> {
  state: State = { err: null };

  static getDerivedStateFromError(err: Error): State {
    return { err };
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.err) {
      this.setState({ err: null });
    }
  }

  componentDidCatch(err: Error, info: React.ErrorInfo) {
    // Surface stack to the browser console so devs can debug; in
    // production we'd ship this to Sentry/etc. via a hook here.
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught:", err, info);
  }

  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div
        role="alert"
        style={{
          padding: 24,
          margin: 24,
          borderRadius: 14,
          border: "1px solid var(--purple-line)",
          background: "var(--purple-soft)",
          color: "var(--ink)",
          maxWidth: 640,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, color: "var(--purple)" }}>
          Something broke
        </h2>
        <p style={{ margin: "8px 0 14px", color: "var(--ink-2)", fontSize: 13 }}>
          The page hit an unexpected error. Reload to retry — your data is safe.
        </p>
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") window.location.reload();
          }}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid var(--purple-line)",
            background: "var(--panel)",
            color: "var(--purple)",
            cursor: "pointer",
            font: "inherit",
            fontSize: 13,
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}
