"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { auth } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { useUI } from "../../lib/ui-context";
import "../auth.css";

export default function SignupPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const { s } = useUI();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await auth.signup(email, password, displayName);
      await refresh();
      router.push("/");
    } catch (e: unknown) {
      const errObj = e as { error?: string; message?: string };
      setErr(errObj?.error || errObj?.message || "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <h1>{s.createAccount}</h1>
        <p className="lead">{s.signUpToContinue}</p>
        {err && <div className="auth-err">{err}</div>}
        <div className="auth-field">
          <label htmlFor="name">Display name (optional)</label>
          <input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" />
        </div>
        <div className="auth-field">
          <label htmlFor="email">{s.emailLabel}</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div className="auth-field">
          <label htmlFor="password">{s.passwordLabel}</label>
          <input id="password" type="password" required minLength={12} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </div>
        <button className="auth-btn" type="submit" disabled={busy}>{busy ? "…" : s.createAccount}</button>
        <p className="auth-foot">{s.alreadyHaveAccount} <Link href="/login">{s.signInLink}</Link></p>
      </form>
    </div>
  );
}
