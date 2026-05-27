"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { auth } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import "../auth.css";

// Two-step login:
//   1. Submit email + password.
//   2. If the backend responds with {mfaRequired: true}, we swap the
//      password field for a code prompt and POST the same endpoint with
//      `mfaCode` populated. The backend ONLY sets the session cookie
//      when both legs pass — so a stolen password without the second
//      factor never gets a working session.
export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (mfaRequired) {
        await auth.loginWithMFA(email, password, mfaCode);
      } else {
        await auth.login(email, password);
      }
      await refresh();
      router.push("/");
    } catch (e: any) {
      // The backend signals "password ok, code needed" with a 401 that
      // carries {mfaRequired: true}. We swap the form into code-prompt
      // mode rather than showing it as a hard error.
      if (e && typeof e === "object" && e.mfaRequired) {
        setMfaRequired(true);
        setErr(e.error || null);
      } else {
        setErr(e?.error || "Login failed");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <h1>Welcome back</h1>
        <p className="lead">
          {mfaRequired
            ? "Enter the 6-digit code from your authenticator app, or a backup code."
            : "Sign in to continue with Babbage AI."}
        </p>
        {err && <div className="auth-err">{err}</div>}
        {!mfaRequired && (
          <>
            <div className="auth-field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="auth-field">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
          </>
        )}
        {mfaRequired && (
          <div className="auth-field">
            <label htmlFor="mfaCode">Authenticator code</label>
            <input
              id="mfaCode"
              type="text"
              inputMode="text"
              required
              autoFocus
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              placeholder="123456 or XXXX-XXXX"
              autoComplete="one-time-code"
            />
          </div>
        )}
        <button className="auth-btn" type="submit" disabled={busy}>
          {busy ? "…" : mfaRequired ? "Verify and sign in" : "Sign in"}
        </button>
        {!mfaRequired && (
          <p className="auth-foot" style={{ marginBottom: 6 }}>
            <Link href="/forgot-password">Forgot password?</Link>
          </p>
        )}
        <p className="auth-foot">No account yet? <Link href="/signup">Create one</Link></p>
      </form>
    </div>
  );
}
