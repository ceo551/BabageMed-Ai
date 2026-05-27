"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { auth } from "../../lib/api";
import "../auth.css";

// Consumes /verify-email?uid=…&token=… — both come from the link in
// the verification email. The verification call is anonymous (the
// token IS the credential), so this page works whether the user is
// logged in or not.
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="auth-shell" />}>
      <VerifyInner />
    </Suspense>
  );
}

function VerifyInner() {
  const params = useSearchParams();
  const uid = params?.get("uid") || "";
  const token = params?.get("token") || "";
  const [state, setState] = useState<"loading" | "ok" | "err">("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!uid || !token) {
      setState("err");
      setMsg("This verification link is missing required parameters.");
      return;
    }
    auth.verifyEmail(uid, token)
      .then(() => setState("ok"))
      .catch((e) => {
        setState("err");
        setMsg(e?.error || "Verification failed — the link may be expired.");
      });
  }, [uid, token]);

  return (
    <div className="auth-shell">
      <div className="auth-card">
        {state === "loading" && (
          <>
            <h1>Verifying…</h1>
            <p className="lead">Hold on a second.</p>
          </>
        )}
        {state === "ok" && (
          <>
            <h1>Email verified</h1>
            <p className="lead">Your email address is now confirmed.</p>
            <p className="auth-foot"><Link href="/">Continue to Babbage</Link></p>
          </>
        )}
        {state === "err" && (
          <>
            <h1>Couldn't verify</h1>
            <p className="lead">{msg}</p>
            <p className="auth-foot">Sign in and request a new verification link from Settings.</p>
          </>
        )}
      </div>
    </div>
  );
}
