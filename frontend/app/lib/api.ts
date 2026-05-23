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
