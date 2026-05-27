"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { auth } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import "../auth.css";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await auth.login(email, password);
      await refresh();
      router.push("/");
    } catch (e: any) {
      setErr(e.error || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <h1>Welcome back</h1>
        <p className="lead">Sign in to continue with Babbage AI.</p>
        {err && <div className="auth-err">{err}</div>}
        <div className="auth-field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div className="auth-field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        <button className="auth-btn" type="submit" disabled={busy}>{busy ? "…" : "Sign in"}</button>
        <p className="auth-foot" style={{ marginBottom: 6 }}>
          <Link href="/forgot-password">Forgot password?</Link>
        </p>
        <p className="auth-foot">No account yet? <Link href="/signup">Create one</Link></p>
      </form>
    </div>
  );
}
