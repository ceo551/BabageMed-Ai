"use client";

// User Settings page — General + Usage tabs.
// Separate from /admin which is for system-wide management; this one only
// reads/writes the signed-in user's own row. Tabs are query-string driven
// (?t=general / ?t=usage) so a deep link from the sidebar lands on the
// right pane.
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { auth as authApi, type ProfilePatch, type UsageReport, type User } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useUI } from "../lib/ui-context";
import { usePrefs } from "../lib/store";
import { findModelById } from "../lib/models";
import "./settings.css";

type Tab = "general" | "security" | "usage";

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="settings-shell"><h1>Settings</h1></div>}>
      <SettingsInner />
    </Suspense>
  );
}

function SettingsInner() {
  const { user, loading, refresh } = useAuth();
  const { s } = useUI();
  const params = useSearchParams();
  const router = useRouter();
  const tab = (params?.get("t") || "general") as Tab;

  function setTab(t: Tab) {
    const u = new URL(window.location.href);
    u.searchParams.set("t", t);
    router.replace(u.pathname + "?" + u.searchParams.toString());
  }

  if (loading) {
    return <div className="settings-shell"><p style={{ color: "var(--muted)" }}>Loading…</p></div>;
  }
  if (!user) {
    return (
      <div className="settings-shell">
        <h1>Settings</h1>
        <p style={{ color: "var(--muted)" }}>
          You need to be signed in to view your settings. <Link href="/login" style={{ color: "var(--cyan)" }}>Sign in →</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="settings-shell">
      <h1>Settings</h1>
      <div className="settings-grid">
        <nav className="settings-nav" aria-label={s.settingsNavLabel}>
          <button data-active={tab === "general"} onClick={() => setTab("general")} type="button">General</button>
          <button data-active={tab === "security"} onClick={() => setTab("security")} type="button">Security</button>
          <button data-active={tab === "usage"} onClick={() => setTab("usage")} type="button">Usage</button>
        </nav>
        <div className="settings-pane">
          {tab === "general" && <GeneralTab user={user} refresh={refresh} />}
          {tab === "security" && <SecurityTab user={user} refresh={refresh} />}
          {tab === "usage" && <UsageTab />}
        </div>
      </div>
    </div>
  );
}

// ─── General tab ────────────────────────────────────────────────────────────
function GeneralTab({ user, refresh }: { user: User; refresh: () => Promise<void> }) {
  const [displayName, setDisplayName] = useState(user.displayName || "");
  const [preferredName, setPreferredName] = useState(user.preferredName || "");
  const [profession, setProfession] = useState(user.profession || "");
  const [instructions, setInstructions] = useState(user.instructions || "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Track what's actually changed so the Save button greys out when the form
  // matches what's on the server — small UX nudge so users don't fire empty
  // PATCH requests.
  const dirty =
    displayName !== (user.displayName || "") ||
    preferredName !== (user.preferredName || "") ||
    profession !== (user.profession || "") ||
    instructions !== (user.instructions || "");

  const initials = useMemo(() => {
    const src = (preferredName || displayName || user.email || "").trim();
    const parts = src.split(/\s+/).filter(Boolean).slice(0, 2);
    return (parts.map((p) => p[0]).join("") || "?").toUpperCase();
  }, [preferredName, displayName, user.email]);

  async function onSave() {
    setSaving(true);
    setErr(null);
    try {
      const patch: ProfilePatch = {
        displayName,
        preferredName,
        profession,
        instructions,
      };
      await authApi.updateMe(patch);
      await refresh();
      setSavedAt(Date.now());
    } catch (e: any) {
      setErr(e?.error || String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="settings-section">
        <h2>Profile</h2>
        <div className="settings-row">
          <div className="label">Avatar</div>
          <div className="control">
            <span className="settings-avatar">{initials}</span>
          </div>
        </div>
        <div className="settings-row">
          <div className="label">Full name</div>
          <div className="control">
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              maxLength={120}
            />
          </div>
        </div>
        <div className="settings-row">
          <div className="label">What should the assistant call you?</div>
          <div className="control">
            <input
              className="input"
              value={preferredName}
              onChange={(e) => setPreferredName(e.target.value)}
              placeholder="e.g. Dr. Ramadan"
              maxLength={80}
            />
          </div>
        </div>
        <div className="settings-row">
          <div className="label">What best describes your work?</div>
          <div className="control">
            <select value={profession} onChange={(e) => setProfession(e.target.value)}>
              <option value="">Select…</option>
              <option value="healthcare">Healthcare &amp; life sciences</option>
              <option value="writer">Writer / Content creator</option>
              <option value="translator">Translator / Linguist</option>
              <option value="business">Business / Operations</option>
              <option value="finance">Financial</option>
              <option value="consultant">Consultant / Professional services</option>
              <option value="researcher">Researcher / Scientist</option>
              <option value="educator">Educator</option>
              <option value="student">Student</option>
              <option value="developer">Developer</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <div className="settings-row">
          <div className="label">Email</div>
          <div className="control" style={{ color: "var(--muted)" }}>{user.email}</div>
        </div>
        <div className="settings-row">
          <div className="label">Plan</div>
          <div className="control" style={{ color: "var(--muted)", textTransform: "capitalize" }}>
            {user.plan}{user.isAdmin && " · admin"}
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h2>Instructions for the assistant</h2>
        <div className="settings-row col">
          <div className="hint">
            The assistant keeps these in mind across every chat. Useful for tone,
            domain focus, preferred output format, citation style, or boilerplate
            disclaimers you always want appended. Per-feature instructions on
            /features/* override these for that workflow.
          </div>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g. I'm a B2B SaaS founder writing for engineers. Prefer concise answers, code samples in TypeScript, and cite primary docs over blog posts."
            dir="auto"
            maxLength={4000}
          />
        </div>
      </div>

      {err && <div className="settings-err">{err}</div>}

      <div className="settings-actions">
        {savedAt && !dirty && <span className="settings-saved">Saved ✓</span>}
        <button className="settings-save" onClick={onSave} disabled={saving || !dirty} type="button">
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </>
  );
}

// ─── Usage tab ───────────────────────────────────────────────────────────────
function UsageTab() {
  const { model } = usePrefs();
  const [report, setReport] = useState<UsageReport | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi.usage()
      .then((r) => setReport(r))
      .catch((e: any) => setErr(e?.error || String(e)))
      .finally(() => setLoading(false));
  }, []);

  // Soft per-plan ceilings for the visual bar. The backend doesn't enforce
  // these today (no quota gate on /api/chat); they're here purely so the
  // user has a sense of where they are. Numbers can move once a real
  // metering layer ships.
  const planLimits: Record<string, number> = { free: 50, pro: 1000, max: 10000 };

  function labelFor(modelId: string): string {
    // Usage rows can reference any text / image / video model id, so
    // findModelById searches all three lists. Unknown id → raw id (may
    // appear briefly after a model is renamed; better than blanking).
    const m = findModelById(modelId);
    return m ? m.name : modelId;
  }

  if (loading) return <p style={{ color: "var(--muted)" }}>Loading usage…</p>;
  if (err) return <div className="settings-err">{err}</div>;
  if (!report) return null;

  const limit = planLimits[report.plan.toLowerCase()] ?? 0;

  return (
    <>
      <div className="settings-section">
        <h2>Usage — last 30 days</h2>
        <p style={{ color: "var(--muted)", margin: 0, fontSize: 13 }}>
          Counts of assistant replies, grouped by the model that answered. Plan
          ceilings are advisory — the backend doesn&apos;t enforce a hard cutoff
          yet. Your active model is <strong style={{ color: "var(--cyan)" }}>{labelFor(model)}</strong>.
        </p>
        {report.items.length === 0 ? (
          <div className="usage-empty">No chat activity in the last 30 days yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {report.items.map((it) => {
              const cap = it.limit > 0 ? it.limit : limit;
              const pct = cap > 0 ? Math.min(100, (Number(it.count) / cap) * 100) : 0;
              return (
                <div className="usage-card" key={it.model}>
                  <span className="model-name">{labelFor(it.model)}</span>
                  <span className="count">
                    {Number(it.count).toLocaleString()}
                    {cap > 0 && (
                      <span style={{ color: "var(--muted-2)" }}>{" / "}{cap.toLocaleString()}</span>
                    )}
                  </span>
                  {cap > 0 && (
                    <span className="bar"><span style={{ width: pct + "%" }} /></span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="settings-section">
        <h2>Plan</h2>
        <p style={{ color: "var(--muted)", margin: 0, fontSize: 13 }}>
          You&apos;re on the <strong style={{ textTransform: "capitalize", color: "var(--ink)" }}>{report.plan}</strong> plan.{" "}
          <Link href="/billing" style={{ color: "var(--cyan)" }}>Manage subscription →</Link>
        </p>
      </div>
    </>
  );
}

// ── Security tab ────────────────────────────────────────────────────────
// Three blocks:
//   1. Email verification status + resend.
//   2. MFA (TOTP) enrollment / disable, with QR-secret + backup codes.
//   3. Session controls — sign out from all devices.
function SecurityTab({ user, refresh }: { user: User; refresh: () => Promise<void> }) {
  return (
    <>
      <EmailVerifyBlock user={user} />
      <MFABlock />
      <SessionsBlock refresh={refresh} />
    </>
  );
}

function EmailVerifyBlock({ user }: { user: User }) {
  const verified = !!user.emailVerifiedAt;
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function resend() {
    setBusy(true);
    setErr(null);
    try {
      await authApi.resendVerifyEmail();
      setSent(true);
    } catch (e: any) {
      setErr(e?.error || "Couldn't send verification email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="settings-section">
      <h2>Email verification</h2>
      {verified ? (
        <p style={{ color: "var(--muted)" }}>
          Your email <strong>{user.email}</strong> is verified.
        </p>
      ) : (
        <>
          <p style={{ color: "var(--muted)", marginBottom: 10 }}>
            <strong>{user.email}</strong> isn't verified yet. Verifying confirms
            password-reset links and billing receipts reach a real inbox.
          </p>
          {err && <div className="settings-err">{err}</div>}
          {sent ? (
            <p style={{ color: "var(--cyan)" }}>Sent. Check your inbox for the verification link.</p>
          ) : (
            <button className="settings-btn" type="button" onClick={resend} disabled={busy}>
              {busy ? "Sending…" : "Send verification email"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function MFABlock() {
  const [status, setStatus] = useState<{ enabled: boolean; enabledAt?: string; backupCodesLeft: number } | null>(null);
  const [phase, setPhase] = useState<"idle" | "enrolling" | "disabling">("idle");
  const [enrollData, setEnrollData] = useState<{ uri: string; secret: string } | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    authApi.mfaStatus().then(setStatus).catch(() => setStatus({ enabled: false, backupCodesLeft: 0 }));
  }, []);

  async function startEnroll() {
    setBusy(true); setErr(null);
    try {
      const r = await authApi.mfaEnrollStart();
      setEnrollData(r);
      setPhase("enrolling");
    } catch (e: any) {
      // 503 → MFA isn't configured server-side (MFA_ENCRYPTION_KEY missing).
      setErr(e?.error || "Couldn't start enrollment.");
    } finally { setBusy(false); }
  }

  async function confirmEnroll() {
    setBusy(true); setErr(null);
    try {
      const r = await authApi.mfaEnrollConfirm(confirmCode);
      setBackupCodes(r.backupCodes);
      const s = await authApi.mfaStatus();
      setStatus(s);
      setEnrollData(null);
      setConfirmCode("");
    } catch (e: any) {
      setErr(e?.error || "Invalid code.");
    } finally { setBusy(false); }
  }

  async function disable(code: string) {
    setBusy(true); setErr(null);
    try {
      await authApi.mfaDisable(code);
      const s = await authApi.mfaStatus();
      setStatus(s);
      setPhase("idle");
    } catch (e: any) {
      setErr(e?.error || "Invalid code.");
    } finally { setBusy(false); }
  }

  if (status === null) {
    return <div className="settings-section"><h2>Two-factor authentication</h2><p style={{ color: "var(--muted)" }}>Loading…</p></div>;
  }

  // After-success view: show the user their backup codes ONCE.
  if (backupCodes) {
    return (
      <div className="settings-section">
        <h2>MFA enabled</h2>
        <p style={{ color: "var(--muted)", marginBottom: 10 }}>
          Save these backup codes somewhere safe. Each works once — use one if you lose
          access to your authenticator app. They're shown <strong>only this once</strong>.
        </p>
        <pre style={{
          background: "var(--bg-2)", padding: 12, borderRadius: 10,
          fontFamily: "var(--mono)", fontSize: 13, lineHeight: 1.6,
        }}>{backupCodes.join("\n")}</pre>
        <button className="settings-btn" type="button" onClick={() => setBackupCodes(null)}>I've saved them</button>
      </div>
    );
  }

  // Enrollment in progress.
  if (phase === "enrolling" && enrollData) {
    return (
      <div className="settings-section">
        <h2>Enable two-factor authentication</h2>
        <p style={{ color: "var(--muted)", marginBottom: 10 }}>
          Scan this QR code with your authenticator app (Google Authenticator, 1Password, Authy,
          Bitwarden, etc.), or type the secret manually.
        </p>
        <div style={{ display: "flex", gap: 18, alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap" }}>
          <img
            alt="MFA QR code"
            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(enrollData.uri)}`}
            width={180}
            height={180}
            style={{ borderRadius: 8, background: "white", padding: 8 }}
          />
          <div style={{ flex: 1, minWidth: 220 }}>
            <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 6 }}>Manual secret:</p>
            <code style={{
              display: "block",
              background: "var(--bg-2)", padding: "8px 10px", borderRadius: 8,
              fontFamily: "var(--mono)", fontSize: 12, wordBreak: "break-all",
            }}>{enrollData.secret}</code>
          </div>
        </div>
        {err && <div className="settings-err">{err}</div>}
        <div className="settings-field">
          <label htmlFor="confirmCode">Enter the 6-digit code your app shows</label>
          <input
            id="confirmCode"
            type="text"
            inputMode="numeric"
            value={confirmCode}
            onChange={(e) => setConfirmCode(e.target.value)}
            placeholder="123456"
            autoComplete="one-time-code"
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="settings-btn" type="button" onClick={confirmEnroll} disabled={busy || confirmCode.length < 6}>
            {busy ? "Verifying…" : "Confirm and enable"}
          </button>
          <button
            className="settings-btn"
            type="button"
            onClick={() => { setPhase("idle"); setEnrollData(null); setConfirmCode(""); setErr(null); }}
            style={{ background: "transparent", color: "var(--muted)" }}
          >Cancel</button>
        </div>
      </div>
    );
  }

  // Already enabled — offer disable.
  if (status.enabled) {
    return (
      <div className="settings-section">
        <h2>Two-factor authentication</h2>
        <p style={{ color: "var(--cyan)" }}>Enabled. {status.backupCodesLeft} backup code{status.backupCodesLeft === 1 ? "" : "s"} remaining.</p>
        {phase === "disabling" ? (
          <>
            {err && <div className="settings-err">{err}</div>}
            <p style={{ color: "var(--muted)", marginBottom: 10 }}>
              Enter your current authenticator code (or a backup code) to confirm:
            </p>
            <div className="settings-field">
              <label htmlFor="disableCode">Code</label>
              <input id="disableCode" type="text" value={confirmCode} onChange={(e) => setConfirmCode(e.target.value)} autoComplete="one-time-code" placeholder="123456" />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="settings-btn" type="button" onClick={() => disable(confirmCode)} disabled={busy || !confirmCode}>
                {busy ? "Disabling…" : "Disable MFA"}
              </button>
              <button
                className="settings-btn"
                type="button"
                onClick={() => { setPhase("idle"); setConfirmCode(""); setErr(null); }}
                style={{ background: "transparent", color: "var(--muted)" }}
              >Cancel</button>
            </div>
          </>
        ) : (
          <button className="settings-btn" type="button" onClick={() => setPhase("disabling")} style={{ background: "var(--purple-soft)", color: "var(--purple)" }}>
            Disable MFA
          </button>
        )}
      </div>
    );
  }

  // Not enrolled.
  return (
    <div className="settings-section">
      <h2>Two-factor authentication</h2>
      <p style={{ color: "var(--muted)", marginBottom: 10 }}>
        Add a second-factor code to every sign-in. Highly recommended for
        accounts that touch patient data or billing.
      </p>
      {err && <div className="settings-err">{err}</div>}
      <button className="settings-btn" type="button" onClick={startEnroll} disabled={busy}>
        {busy ? "…" : "Enable MFA"}
      </button>
    </div>
  );
}

function SessionsBlock({ refresh }: { refresh: () => Promise<void> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function signOutAll() {
    if (typeof window === "undefined") return;
    if (!window.confirm("Sign out from every device, including this one?")) return;
    setBusy(true); setErr(null);
    try {
      await authApi.logoutAll();
      await refresh();
      router.push("/login");
    } catch (e: any) {
      setErr(e?.error || "Couldn't sign out.");
      setBusy(false);
    }
  }

  return (
    <div className="settings-section">
      <h2>Sessions</h2>
      <p style={{ color: "var(--muted)", marginBottom: 10 }}>
        Revoke every active session — useful if you suspect your password leaked.
      </p>
      {err && <div className="settings-err">{err}</div>}
      <button className="settings-btn" type="button" onClick={signOutAll} disabled={busy} style={{ background: "var(--purple-soft)", color: "var(--purple)" }}>
        {busy ? "Signing out…" : "Sign out from all devices"}
      </button>
    </div>
  );
}
