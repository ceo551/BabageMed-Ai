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
import { usePrefs } from "../lib/store";
import { MODELS } from "../i18n";
import "./settings.css";

type Tab = "general" | "usage";

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="settings-shell"><h1>Settings</h1></div>}>
      <SettingsInner />
    </Suspense>
  );
}

function SettingsInner() {
  const { user, loading, refresh } = useAuth();
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
        <nav className="settings-nav" aria-label="Settings navigation">
          <button data-active={tab === "general"} onClick={() => setTab("general")} type="button">General</button>
          <button data-active={tab === "usage"} onClick={() => setTab("usage")} type="button">Usage</button>
        </nav>
        <div className="settings-pane">
          {tab === "general" ? <GeneralTab user={user} refresh={refresh} /> : <UsageTab />}
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
              <option value="clinician">Clinician (MD / DO / NP / PA)</option>
              <option value="resident">Resident / Fellow</option>
              <option value="student">Medical student</option>
              <option value="researcher">Researcher / Scientist</option>
              <option value="nurse">Nurse</option>
              <option value="pharmacist">Pharmacist</option>
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
            The assistant keeps these in mind across every chat. Useful for
            specialty focus (e.g. &quot;I work in pediatric nephrology&quot;), preferred
            citation style, or boilerplate disclaimers you always want appended.
          </div>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g. I primarily care for adult inpatients on a cardiology service; default to KDIGO / ACC guidelines when relevant."
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
    const m = MODELS.find((x) => x.id === modelId);
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
