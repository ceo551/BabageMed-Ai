// Tiny fetch wrapper around the backend. Always sends cookies for session auth.
const BASE = "/api/backend";

export type ApiError = { error: string; status: number };

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: "include",
    headers: { "content-type": "application/json", ...(init.headers || {}) },
    ...init,
  });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const err: ApiError = { error: (body && body.error) || text || res.statusText, status: res.status };
    throw err;
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
  createdAt: string;
};

export type ProfilePatch = Partial<Pick<User, "displayName" | "preferredName" | "profession" | "instructions">>;

export type UsageItem = { model: string; count: number; limit: number };
export type UsageReport = { plan: string; window: string; items: UsageItem[] };

export const auth = {
  signup: (email: string, password: string, displayName?: string) =>
    api.post<{ user: User; token: string }>("/api/auth/signup", { email, password, displayName }),
  login:  (email: string, password: string) =>
    api.post<{ user: User; token: string }>("/api/auth/login", { email, password }),
  logout: () => api.post<{ ok: boolean }>("/api/auth/logout"),
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
  kind: "api" | "scrape" | "hybrid";
  category: string;
  port: number;
  base: string;
  iconUrl?: string;
  siteUrl?: string;
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
export type Chat = {
  id: string;
  title: string;
  model: string;
  mode: string;
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
  list:        () => api.get<Chat[]>("/api/chats"),
  create:      (title: string, model: string, mode: string) =>
    api.post<Chat>("/api/chats", { title, model, mode }),
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

export const admin = {
  stats:         () => api.get<AdminStats>("/api/admin/stats"),
  users:         (q = "", limit = 50, offset = 0) =>
    api.get<{ users: AdminUser[]; limit: number; offset: number }>(
      `/api/admin/users?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`
    ),
  updateUser:    (id: string, patch: Partial<{ plan: string; isAdmin: boolean; displayName: string }>) =>
    fetch(`/api/backend/api/admin/users/${encodeURIComponent(id)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }).then((r) => r.json()),
  deleteUser:    (id: string) =>
    fetch(`/api/backend/api/admin/users/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    }).then((r) => r.json()),
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
