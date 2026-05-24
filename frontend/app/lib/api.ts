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
  plan: "free" | "pro" | "max" | string;
  isAdmin: boolean;
  createdAt: string;
};

export const auth = {
  signup: (email: string, password: string, displayName?: string) =>
    api.post<{ user: User; token: string }>("/api/auth/signup", { email, password, displayName }),
  login:  (email: string, password: string) =>
    api.post<{ user: User; token: string }>("/api/auth/login", { email, password }),
  logout: () => api.post<{ ok: boolean }>("/api/auth/logout"),
  me:     () => api.get<{ user: User }>("/api/auth/me"),
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

// ── Spaces ──
export type Space = {
  id: string;
  name: string;
  description: string;
  fileCount: number;
  createdAt: string;
  updatedAt: string;
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
  create: (name: string, description = "") =>
    api.post<Space>("/api/spaces", { name, description }),
  get:    (id: string) => api.get<Space>(`/api/spaces/${encodeURIComponent(id)}`),
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
