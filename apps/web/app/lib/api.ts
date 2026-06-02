// Tiny fetch wrapper around the backend. Always sends cookies for session auth.
const BASE = "/api/backend";

// ApiError carries the standard {error, status} pair AND any extra
// fields the backend included in its error body (e.g. mfaRequired).
// Caller-side, login() leans on the `mfaRequired` flag to decide
// whether to show the second-factor prompt vs a hard failure.
export type ApiError = { error: string; status: number; [key: string]: unknown };

// Listener for 401 responses. AuthProvider registers itself here so a
// session expiring mid-session immediately clears the in-memory user
// + redirects to /login instead of leaving the UI in a half-logged-in
// state where every subsequent call 401s and the user sees their
// chats silently fail with no feedback.
let on401: (() => void) | null = null;
export function setOn401Handler(fn: (() => void) | null) {
  on401 = fn;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: "include",
    headers: { "content-type": "application/json", ...(init.headers || {}) },
    ...init,
  });
  const text = await res.text();
  let body: any = null;
  let parsed = false;
  try {
    body = text ? JSON.parse(text) : null;
    parsed = true;
  } catch {
    body = text;
    parsed = false;
  }
  if (!res.ok) {
    // Global 401 watchdog — see setOn401Handler above. Skip for the
    // login / signup / me endpoints where 401 is the normal way to
    // signal "wrong credentials" / "not signed in"; otherwise a
    // failed login attempt would flush the *current* session before
    // it ever stored the new one.
    if (res.status === 401 && on401 && !path.startsWith("/api/auth/")) {
      on401();
    }
    // Spread the response body so non-error fields (mfaRequired,
    // retryAfter, etc.) survive into catch handlers. The previous
    // version dropped them — login's MFA branch would never see
    // the flag and would render a generic "Login failed" toast.
    const err: ApiError = {
      ...(body && typeof body === "object" ? body : {}),
      error: (body && body.error) || text || res.statusText,
      status: res.status,
    };
    throw err;
  }
  // Treat non-JSON 2xx as a hard error — a proxy 200 with an HTML
  // error page used to be passed back as `T` and crash every
  // downstream `.user`, `.id`, `.title` access with
  // "Cannot read properties of undefined".
  if (text && !parsed) {
    throw {
      error: "non_json_response",
      status: res.status,
    } as ApiError;
  }
  return body as T;
}

export const api = {
  get:  <T = unknown>(p: string) => call<T>(p),
  post: <T = unknown>(p: string, body?: unknown) => call<T>(p, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
};

// ── auth ──
export type User = {
  id: string;
  email: string;
  displayName: string;
  preferredName: string;
  profession: string;
  instructions: string;
  plan: "free" | "pro" | "max" | string;
  isAdmin: boolean;
  // ISO timestamp when the user clicked their verification link;
  // undefined → unverified. Used to render the "verify your email"
  // banner in Settings.
  emailVerifiedAt?: string | null;
  createdAt: string;
};

export type ProfilePatch = Partial<Pick<User, "displayName" | "preferredName" | "profession" | "instructions">>;

export type UsageItem = { model: string; count: number; limit: number };
export type UsageReport = { plan: string; window: string; items: UsageItem[] };

export const auth = {
  signup: (email: string, password: string, displayName?: string) =>
    // Token is delivered via HttpOnly cookie set on the response,
    // never echoed in the body — see backend auth/handler.go.
    api.post<{ user: User }>("/api/auth/signup", { email, password, displayName }),
  login:  (email: string, password: string) =>
    api.post<{ user: User }>("/api/auth/login", { email, password }),
  // Second-leg login: same endpoint, with the TOTP / backup code added.
  // Returns the same { user } shape; the backend sets the session
  // cookie only after BOTH password + mfaCode validate.
  loginWithMFA: (email: string, password: string, mfaCode: string) =>
    api.post<{ user: User }>("/api/auth/login", { email, password, mfaCode }),
  // MFA management — all require an active session.
  mfaStatus: () =>
    api.get<{ enabled: boolean; enabledAt?: string; backupCodesLeft: number }>("/api/auth/mfa/status"),
  mfaEnrollStart: () =>
    api.post<{ uri: string; secret: string }>("/api/auth/mfa/enroll/start"),
  mfaEnrollConfirm: (code: string) =>
    api.post<{ backupCodes: string[] }>("/api/auth/mfa/enroll/confirm", { code }),
  mfaDisable: (code: string) =>
    api.post<{ ok: boolean }>("/api/auth/mfa/disable", { code }),
  logout: () => api.post<{ ok: boolean }>("/api/auth/logout"),
  // "Sign out from all devices" — revokes every session belonging to
  // the caller, including the current one. Settings exposes this as a
  // credential-compromise affordance.
  logoutAll: () => api.post<{ ok: boolean }>("/api/auth/logout-all"),
  // Password reset — request always returns 200, even when the email
  // isn't registered, so the response code can't be used to enumerate
  // accounts. The user always sees the same "we sent a link" toast.
  forgotPassword: (email: string) =>
    api.post<{ ok: boolean }>("/api/auth/forgot-password", { email }),
  resetPassword: (email: string, token: string, newPassword: string) =>
    api.post<{ ok: boolean }>("/api/auth/reset-password", { email, token, newPassword }),
  // Email verification — sender is the authenticated session; the
  // verify call is anonymous (the link in the email IS the cred).
  resendVerifyEmail: () =>
    api.post<{ ok: boolean }>("/api/auth/resend-verify"),
  verifyEmail: (uid: string, token: string) =>
    api.post<{ ok: boolean }>("/api/auth/verify-email", { uid, token }),
  me:     () => api.get<{ user: User }>("/api/auth/me"),
  // Settings → General: PATCH the four user-editable fields. The backend
  // returns the refreshed row so the client doesn't have to re-fetch.
  updateMe: async (patch: ProfilePatch): Promise<User> => {
    const r = await fetch(`/api/backend/api/auth/me`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    const text = await r.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!r.ok) throw { error: (body && body.error) || text || r.statusText, status: r.status } as ApiError;
    return body.user as User;
  },
  // Settings → Usage: counts of assistant messages grouped by model for
  // the last 30 days. Limit is plan-derived and informational only.
  usage: () => api.get<UsageReport>("/api/auth/me/usage"),
};

// ── MCPs ──
export type McpServer = {
  id: string;
  name: string;
  kind: "api" | "scrape" | "hybrid" | "stub";
  category: string;
  port: number;
  base: string;
  iconUrl?: string;
  siteUrl?: string;
  // Which sidebar feature this server is most relevant to. One of the 10
  // feature slugs — see apps/web/app/i18n.ts FEATURES_EN. Optional only so
  // older cached responses still type-check during the rollout.
  feature?: string;
};

// ── Connectors (user's installed MCPs) ──
export type Connector = {
  mcpId: string;
  name: string;
  kind: "api" | "scrape" | "hybrid";
  category: string;
  base: string;
  iconUrl?: string;
  siteUrl?: string;
  config: Record<string, unknown>;
  connectedAt: string;
};

export const connectors = {
  list:       () => api.get<Connector[]>("/api/connectors"),
  connect:    (mcpId: string, config?: Record<string, unknown>) =>
    api.post<Connector>(`/api/connectors/${encodeURIComponent(mcpId)}`, { config: config || {} }),
  disconnect: (mcpId: string) =>
    fetch(`/api/backend/api/connectors/${encodeURIComponent(mcpId)}`, {
      method: "DELETE",
      credentials: "include",
    }).then((r) => {
      if (!r.ok) throw { error: r.statusText, status: r.status } as ApiError;
    }),
};

export type McpToolSchema = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, { type?: string; description?: string; enum?: string[]; items?: any }>;
    required?: string[];
  };
};

export const mcps = {
  list:  () => api.get<{ servers: McpServer[] }>("/api/mcp/servers"),
  get:   (id: string) => api.get<McpServer>(`/api/mcp/servers/${encodeURIComponent(id)}`),
  tools: (id: string) => api.get<{ tools: McpToolSchema[] }>(`/api/mcp/servers/${encodeURIComponent(id)}/tools`),
  call:  (id: string, tool: string, args: unknown) =>
    api.post<{ ok: boolean; result: unknown }>(`/api/mcp/call/${encodeURIComponent(id)}/${encodeURIComponent(tool)}`, args),
};

// ── admin ──
export type AdminStats = {
  users: number;
  admins: number;
  activeSessions: number;
  paymentsPaid: number;
  paymentsPending: number;
  paymentsFailed: number;
};
export type AdminUser = User;
export type AdminPayment = {
  id: string;
  userId: string;
  userEmail: string;
  provider: string;
  externalId: string;
  planId: string;
  amountMinor: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "refunded";
  createdAt: string;
};
export type AdminSession = {
  id: string;
  userId: string;
  userEmail: string;
  userAgent: string;
  ip: string;
  expiresAt: string;
  createdAt: string;
};

// ── Chats (persisted conversations) ──
//
// `feature` is "" for main-dashboard chats and a feature slug
// ("healthcare" / "writing" / …) for chats started from a feature page.
// The sidebar filters by feature so each feature has its own history; the
// general History row uses ?feature=general (NULL / empty backend-side).
export type Chat = {
  id: string;
  title: string;
  model: string;
  mode: string;
  feature?: string;
  createdAt: string;
  updatedAt: string;
};
export type ChatMessageRow = {
  id: string;
  chatId: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: unknown;
  meta?: unknown;
  createdAt: string;
};
export const chats = {
  // `feature` filters chats by ownership:
  //   undefined          → every chat the user has (admin/debug only)
  //   "general"          → only main-dashboard chats (feature_slug IS NULL)
  //   <slug>             → only chats started from /features/<slug>
  list:        (feature?: string) => {
    const qs = feature ? `?feature=${encodeURIComponent(feature)}` : "";
    return api.get<Chat[]>(`/api/chats${qs}`);
  },
  create:      (title: string, model: string, mode: string, feature?: string) =>
    api.post<Chat>("/api/chats", { title, model, mode, feature }),
  get:         (id: string) => api.get<Chat>(`/api/chats/${encodeURIComponent(id)}`),
  messages:    (id: string) => api.get<ChatMessageRow[]>(`/api/chats/${encodeURIComponent(id)}/messages`),
  append:      (id: string, body: { role: string; content: string; citations?: unknown; meta?: unknown }) =>
    api.post<ChatMessageRow>(`/api/chats/${encodeURIComponent(id)}/messages`, body),
  rename:      async (id: string, title: string): Promise<Chat> => {
    const r = await fetch(`/api/backend/api/chats/${encodeURIComponent(id)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const text = await r.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!r.ok) throw { error: (body && body.error) || text || r.statusText, status: r.status } as ApiError;
    return body;
  },
  remove:      (id: string) =>
    fetch(`/api/backend/api/chats/${encodeURIComponent(id)}`, {
      method: "DELETE", credentials: "include",
    }).then((r) => {
      if (!r.ok) throw { error: r.statusText, status: r.status } as ApiError;
    }),
};

// ── Spaces ──
export type Space = {
  id: string;
  name: string;
  description: string;
  icon: string;          // emoji glyph picked at create time, "" if unset
  instructions: string;  // custom system-prompt prefix for the agent
  fileCount: number;
  createdAt: string;
  updatedAt: string;
};
export type CreateSpaceInput = {
  name: string;
  description?: string;
  icon?: string;
  instructions?: string;
};
export type SpaceFile = {
  id: string;
  spaceId: string;
  name: string;
  mime: string;
  sizeBytes: number;
  md5: string;
  hasText: boolean;
  chunkCount: number;
  createdAt: string;
};
export type SpaceChunk = {
  id: string;
  fileId: string;
  fileName: string;
  idx: number;
  content: string;
  score: number;
};

export const spaces = {
  list:   () => api.get<Space[]>("/api/spaces"),
  create: (input: CreateSpaceInput) =>
    api.post<Space>("/api/spaces", {
      name: input.name,
      description: input.description || "",
      icon: input.icon || "",
      instructions: input.instructions || "",
    }),
  get:    (id: string) => api.get<Space>(`/api/spaces/${encodeURIComponent(id)}`),
  update: async (id: string, patch: Partial<Pick<Space, "name"|"description"|"icon"|"instructions">>): Promise<Space> => {
    const r = await fetch(`/api/backend/api/spaces/${encodeURIComponent(id)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    const text = await r.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!r.ok) throw { error: (body && body.error) || text || r.statusText, status: r.status } as ApiError;
    return body;
  },
  remove: (id: string) =>
    fetch(`/api/backend/api/spaces/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" }).then((r) => {
      if (!r.ok) throw { error: r.statusText, status: r.status } as ApiError;
    }),
  files:  (id: string) => api.get<SpaceFile[]>(`/api/spaces/${encodeURIComponent(id)}/files`),
  upload: async (id: string, file: File): Promise<SpaceFile> => {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch(`/api/backend/api/spaces/${encodeURIComponent(id)}/files`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    const text = await r.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!r.ok) throw { error: (body && body.error) || text || r.statusText, status: r.status } as ApiError;
    return body;
  },
  removeFile: (spaceId: string, fileId: string) =>
    fetch(`/api/backend/api/spaces/${encodeURIComponent(spaceId)}/files/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      credentials: "include",
    }).then((r) => {
      if (!r.ok) throw { error: r.statusText, status: r.status } as ApiError;
    }),
  context: (id: string, q: string) =>
    api.get<SpaceChunk[]>(`/api/spaces/${encodeURIComponent(id)}/context?q=${encodeURIComponent(q)}`),
};

// ── Features ─────────────────────────────────────────────────────────────
// Per-feature workspace (Education, Writing, Translation, Data
// Analysis, Business, Financial, Consulting, Image & Video, Advertisements).
// The backend upserts on first GET so the frontend never has to handle a
// 404 for one of the 10 fixed slugs. Each feature stores instructions,
// skills, connectors, and a flat file list (PDFs/text uploaded for
// grounding).
export type FeatureFile = {
  id: string;
  name: string;
  size: number;
  mime: string;
  createdAt: string;
};
export type Feature = {
  slug: string;
  instructions: string;
  skills: string[];      // skill ids the user has toggled on
  connectors: string[];  // mcp ids the user wants used for this feature
  files: FeatureFile[];
  updatedAt: string;
};
export type FeaturePatch = Partial<Pick<Feature, "instructions" | "skills" | "connectors">>;

export const features = {
  get: (slug: string) => api.get<Feature>(`/api/features/${encodeURIComponent(slug)}`),
  update: async (slug: string, patch: FeaturePatch): Promise<Feature> => {
    const r = await fetch(`/api/backend/api/features/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    const text = await r.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!r.ok) throw { error: (body && body.error) || text || r.statusText, status: r.status } as ApiError;
    return body;
  },
  upload: async (slug: string, files: FileList): Promise<Feature> => {
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append("file", f);
    const r = await fetch(`/api/backend/api/features/${encodeURIComponent(slug)}/files`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    const text = await r.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!r.ok) throw { error: (body && body.error) || text || r.statusText, status: r.status } as ApiError;
    return body;
  },
  removeFile: async (slug: string, fileId: string): Promise<Feature> => {
    const r = await fetch(
      `/api/backend/api/features/${encodeURIComponent(slug)}/files/${encodeURIComponent(fileId)}`,
      { method: "DELETE", credentials: "include" },
    );
    const text = await r.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!r.ok) throw { error: (body && body.error) || text || r.statusText, status: r.status } as ApiError;
    return body;
  },
};

export const admin = {
  stats:         () => api.get<AdminStats>("/api/admin/stats"),
  users:         (q = "", limit = 50, offset = 0) =>
    api.get<{ users: AdminUser[]; limit: number; offset: number }>(
      `/api/admin/users?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`
    ),
  // Throw on non-2xx so admin UI surfaces failures instead of silently
  // ignoring 401/403/500 (the previous .then((r) => r.json()) treated
  // every response as success, leaving operators confused).
  updateUser:    async (id: string, patch: Partial<{ plan: string; isAdmin: boolean; displayName: string }>) => {
    const r = await fetch(`/api/backend/api/admin/users/${encodeURIComponent(id)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!r.ok) throw new Error(`updateUser: HTTP ${r.status}`);
    return r.json();
  },
  deleteUser:    async (id: string) => {
    const r = await fetch(`/api/backend/api/admin/users/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!r.ok) throw new Error(`deleteUser: HTTP ${r.status}`);
    return r.json();
  },
  payments:      (status = "", limit = 50, offset = 0) =>
    api.get<{ payments: AdminPayment[]; limit: number; offset: number }>(
      `/api/admin/payments?status=${encodeURIComponent(status)}&limit=${limit}&offset=${offset}`
    ),
  updatePayment: (id: string, status: AdminPayment["status"]) =>
    fetch(`/api/backend/api/admin/payments/${encodeURIComponent(id)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    }).then((r) => r.json()),
  sessions:      () => api.get<{ sessions: AdminSession[] }>("/api/admin/sessions"),
  revokeSession: (id: string) =>
    fetch(`/api/backend/api/admin/sessions/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    }).then((r) => r.json()),
};
