"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { auth } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { useUI } from "../../lib/ui-context";
import { readNext } from "../next-target";
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
  const { user, refresh } = useAuth();
  const { s } = useUI();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [next, setNext] = useState("/");
  // Read the ?next bounce-back target on mount (client-only; avoids the
  // useSearchParams Suspense requirement).
  useEffect(() => { setNext(readNext()); }, []);
  // Already authenticated and yet on /login — happens when SameSite=Strict
  // suppressed the session cookie on a cross-site landing so middleware
  // couldn't see it, but the /me probe in auth-context can. Skip the form.
  useEffect(() => { if (user) router.replace(next); }, [user, next, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      // Two-leg login: first call is password-only; backend replies
      // with mfaRequired:true (via ApiError) if a second factor is
      // needed, which the catch handler below routes to the MFA step.
      // Once mfaRequired is true, the form submits via loginWithMFA
      // (different endpoint shape) so the typed signatures match.
      if (mfaRequired) {
        await auth.loginWithMFA(email, password, mfaCode);
      } else {
        await auth.login(email, password);
      }
      await refresh();
      router.push(next);
    } catch (e: unknown) {
      const errObj = e as { error?: string; mfaRequired?: boolean; message?: string };
      if (errObj?.mfaRequired) {
        setMfaRequired(true);
        return;
      }
      setErr(errObj?.error || errObj?.message || "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <h1>{s.welcomeBack}</h1>
        <p className="lead">
          {mfaRequired ? s.mfaCodePrompt : s.signInToContinue}
        </p>
        {err && <div className="auth-err">{err}</div>}
        {!mfaRequired && (
          <>
            <div className="auth-field">
              <label htmlFor="email">{s.emailLabel}</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="auth-field">
              <label htmlFor="password">{s.passwordLabel}</label>
              <input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
          </>
        )}
        {mfaRequired && (
          <div className="auth-field">
            <label htmlFor="mfaCode">{s.authenticatorCode}</label>
            <input
              id="mfaCode"
              type="text"
              inputMode="text"
              required
              autoFocus
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              placeholder={s.mfaCodePlaceholder}
              autoComplete="one-time-code"
            />
          </div>
        )}
        <button className="auth-btn" type="submit" disabled={busy}>
          {busy ? "…" : mfaRequired ? s.verifyAndSignIn : s.signInCta}
        </button>
        {!mfaRequired && (
          <p className="auth-foot" style={{ marginBottom: 6 }}>
            <Link href="/forgot-password">{s.forgotPassword}</Link>
          </p>
        )}
        <p className="auth-foot">{s.noAccountYet} <Link href="/signup">{s.createOne}</Link></p>
      </form>
    </div>
  );
}
