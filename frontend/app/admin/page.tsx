"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { admin, type AdminPayment, type AdminSession, type AdminStats, type AdminUser } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import "./admin.css";

type Tab = "overview" | "users" | "payments" | "sessions";

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");

  if (loading) return <div className="admin-shell"><p className="lead">Loading…</p></div>;
  if (!user) {
    return (
      <div className="admin-shell">
        <div className="admin-blocked">You need to sign in to view the admin panel. <Link href="/login" style={{ color: "var(--cyan)" }}>Sign in</Link>.</div>
      </div>
    );
  }
  if (!user.isAdmin) {
    return (
      <div className="admin-shell">
        <div className="admin-blocked">Admin access required. Ask an administrator to promote your account, or set BOOTSTRAP_ADMIN_EMAIL to your address and restart the backend.</div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <Link href="/" style={{ color: "var(--cyan)", fontSize: 13 }}>← Dashboard</Link>
      <h1>Admin</h1>
      <p className="lead">Manage users, payments, and active sessions.</p>

      <div className="admin-tabs">
        {(["overview", "users", "payments", "sessions"] as Tab[]).map((t) => (
          <button key={t} data-active={t === tab} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === "overview" && <Overview />}
      {tab === "users" && <UsersTab />}
      {tab === "payments" && <PaymentsTab />}
      {tab === "sessions" && <SessionsTab />}
    </div>
  );
}

function Overview() {
  const [s, setS] = useState<AdminStats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    admin.stats().then(setS).catch((e) => setErr(e.error || String(e)));
  }, []);
  if (err) return <div className="admin-blocked">{err}</div>;
  if (!s) return <p className="lead">Loading…</p>;
  return (
    <div className="admin-stats">
      <Stat label="Users" val={s.users} />
      <Stat label="Admins" val={s.admins} />
      <Stat label="Active sessions" val={s.activeSessions} />
      <Stat label="Payments — paid" val={s.paymentsPaid} />
      <Stat label="Payments — pending" val={s.paymentsPending} />
      <Stat label="Payments — failed" val={s.paymentsFailed} />
    </div>
  );
}

function Stat({ label, val }: { label: string; val: number }) {
  return (
    <div className="admin-stat">
      <div className="label">{label}</div>
      <div className="val">{val.toLocaleString()}</div>
    </div>
  );
}

function UsersTab() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const { user: me } = useAuth();

  async function refresh() {
    try {
      const r = await admin.users(q);
      setRows(r.users);
      setErr(null);
    } catch (e: any) {
      setErr(e.error || String(e));
    }
  }
  useEffect(() => { refresh(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [q]);

  async function setPlan(id: string, plan: string) {
    await admin.updateUser(id, { plan });
    refresh();
  }
  async function setAdmin(id: string, isAdmin: boolean) {
    await admin.updateUser(id, { isAdmin });
    refresh();
  }
  async function del(id: string, email: string) {
    if (!confirm(`Delete ${email}? This is permanent.`)) return;
    const r = await admin.deleteUser(id);
    if (r.error) alert(r.error);
    refresh();
  }

  return (
    <>
      <div className="admin-toolbar">
        <input type="search" placeholder="Search by email or name…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="lead" style={{ marginInlineStart: "auto" }}>{rows.length} users</span>
      </div>
      {err && <div className="admin-blocked">{err}</div>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Display name</th>
              <th>Plan</th>
              <th>Admin</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>{u.email} {me?.id === u.id && <span className="admin-pill admin">you</span>}</td>
                <td>{u.displayName || <span className="mono">—</span>}</td>
                <td>
                  <select value={u.plan} onChange={(e) => setPlan(u.id, e.target.value)}>
                    <option value="free">free</option>
                    <option value="pro">pro</option>
                    <option value="max">max</option>
                  </select>
                  <span className={`admin-pill ${u.plan}`} style={{ marginInlineStart: 8 }}>{u.plan}</span>
                </td>
                <td>
                  <input type="checkbox" checked={u.isAdmin} onChange={(e) => setAdmin(u.id, e.target.checked)} />
                  {u.isAdmin && <span className="admin-pill admin" style={{ marginInlineStart: 8 }}>admin</span>}
                </td>
                <td className="mono">{u.createdAt?.slice(0, 10)}</td>
                <td>
                  {me?.id !== u.id && (
                    <button className="danger" onClick={() => del(u.id, u.email)}>Delete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PaymentsTab() {
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<AdminPayment[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    try {
      const r = await admin.payments(status);
      setRows(r.payments);
      setErr(null);
    } catch (e: any) {
      setErr(e.error || String(e));
    }
  }
  useEffect(() => { refresh(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [status]);

  async function update(id: string, s: AdminPayment["status"]) {
    await admin.updatePayment(id, s);
    refresh();
  }

  return (
    <>
      <div className="admin-toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">pending</option>
          <option value="paid">paid</option>
          <option value="failed">failed</option>
          <option value="refunded">refunded</option>
        </select>
        <span className="lead" style={{ marginInlineStart: "auto" }}>{rows.length} payments</span>
      </div>
      {err && <div className="admin-blocked">{err}</div>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>When</th>
              <th>User</th>
              <th>Provider</th>
              <th>Plan</th>
              <th>Amount</th>
              <th>Status</th>
              <th>External ID</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="mono">{p.createdAt?.slice(0, 16).replace("T", " ")}</td>
                <td>{p.userEmail || <span className="mono">—</span>}</td>
                <td>{p.provider}</td>
                <td>{p.planId || <span className="mono">—</span>}</td>
                <td className="mono">{(p.amountMinor / 100).toFixed(2)} {p.currency}</td>
                <td>
                  <select value={p.status} onChange={(e) => update(p.id, e.target.value as AdminPayment["status"])}>
                    <option value="pending">pending</option>
                    <option value="paid">paid</option>
                    <option value="failed">failed</option>
                    <option value="refunded">refunded</option>
                  </select>
                  <span className={`admin-pill ${p.status}`} style={{ marginInlineStart: 8 }}>{p.status}</span>
                </td>
                <td className="mono">{p.externalId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SessionsTab() {
  const [rows, setRows] = useState<AdminSession[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    try {
      const r = await admin.sessions();
      setRows(r.sessions);
      setErr(null);
    } catch (e: any) {
      setErr(e.error || String(e));
    }
  }
  useEffect(() => { refresh(); }, []);

  async function revoke(id: string, email: string) {
    if (!confirm(`Revoke session for ${email}?`)) return;
    await admin.revokeSession(id);
    refresh();
  }

  return (
    <>
      <div className="admin-toolbar">
        <span className="lead" style={{ marginInlineStart: "auto" }}>{rows.length} active sessions</span>
      </div>
      {err && <div className="admin-blocked">{err}</div>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>IP</th>
              <th>User agent</th>
              <th>Created</th>
              <th>Expires</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>{s.userEmail}</td>
                <td className="mono">{s.ip || "—"}</td>
                <td className="mono" style={{ maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis" }}>{s.userAgent || "—"}</td>
                <td className="mono">{s.createdAt?.slice(0, 16).replace("T", " ")}</td>
                <td className="mono">{s.expiresAt?.slice(0, 10)}</td>
                <td><button className="danger" onClick={() => revoke(s.id, s.userEmail)}>Revoke</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
