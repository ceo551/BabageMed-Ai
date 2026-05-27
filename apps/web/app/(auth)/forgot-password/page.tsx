"use client";

import Link from "next/link";
import { useState } from "react";
import { auth } from "../../lib/api";
import "../auth.css";

// Forgot-password trigger. The backend always returns 200 (success or
// not) so we never leak which emails are registered — the on-screen
// confirmation is identical regardless. The user-visible cue is "we
// sent a link IF this email is registered".
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await auth.forgotPassword(email);
      setSent(true);
    } catch {
      // Even network errors land on the success screen — the
      // alternative is letting an attacker probe failure modes to
      // distinguish registered vs unregistered emails. The audit log
      // captures the real failure.
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <h1>Check your email</h1>
          <p className="lead">
            If <strong>{email}</strong> is a registered account, we just sent it a
            password-reset link. The link is valid for 60 minutes.
          </p>
          <p className="auth-foot"><Link href="/login">Back to sign in</Link></p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <h1>Reset your password</h1>
        <p className="lead">Enter the email you signed up with and we'll send you a reset link.</p>
        <div className="auth-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <button className="auth-btn" type="submit" disabled={busy}>{busy ? "…" : "Send reset link"}</button>
        <p className="auth-foot"><Link href="/login">Back to sign in</Link></p>
      </form>
    </div>
  );
}
