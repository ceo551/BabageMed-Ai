"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "../../lib/api";
import "../auth.css";

// Consumes a reset link: /reset-password?email=…&token=… — both
// parameters arrive from the email we minted in SendPasswordResetEmail.
// On success every existing session for that user is invalidated by
// the backend (CompletePasswordReset), so the user lands on /login and
// must re-authenticate.
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="auth-shell" />}>
      <ResetInner />
    </Suspense>
  );
}

function ResetInner() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params?.get("email") || "";
  const token = params?.get("token") || "";

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (pw !== pw2) { setErr("Passwords don't match."); return; }
    if (pw.length < 8) { setErr("Password must be at least 8 characters."); return; }
    setBusy(true);
    try {
      await auth.resetPassword(email, token, pw);
      router.push("/login?reset=ok");
    } catch (e: any) {
      setErr(e?.error || "Reset failed — the link may be expired.");
    } finally {
      setBusy(false);
    }
  }

  if (!email || !token) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <h1>Bad link</h1>
          <p className="lead">This reset link is missing required parameters. Request a new one from the sign-in page.</p>
          <p className="auth-foot"><Link href="/forgot-password">Request a new link</Link></p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <h1>Choose a new password</h1>
        <p className="lead">Resetting for <strong>{email}</strong>.</p>
        {err && <div className="auth-err">{err}</div>}
        <div className="auth-field">
          <label htmlFor="pw">New password</label>
          <input id="pw" type="password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        </div>
        <div className="auth-field">
          <label htmlFor="pw2">Confirm new password</label>
          <input id="pw2" type="password" required minLength={8} value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
        </div>
        <button className="auth-btn" type="submit" disabled={busy}>{busy ? "…" : "Set new password"}</button>
      </form>
    </div>
  );
}
