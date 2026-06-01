// @hand-edited — do not regenerate via write-real-tools.mjs
import { z, McpServer, ApiClient, googleAccessToken } from "@pervagans/mcp-base";
// Lazy, persistent client so the response cache + rate-limit slot
// survive across tool invocations. The per-call `new ApiClient(...)`
// pattern reset nextSlot to 0 on every call, completely bypassing the
// rps:3 throttle, and the cache always missed.
let _client: ApiClient | null = null;
async function client(): Promise<ApiClient> {
  if (!_client) _client = new ApiClient({ base: "https://gmail.googleapis.com/gmail/v1", rps: 3 });
  const t = await googleAccessToken();
  (_client as unknown as { opts: { defaultHeaders: Record<string, string> } }).opts.defaultHeaders = { Authorization: `Bearer ${t}` };
  return _client;
}
// Gmail message id regex (Gmail-format string ids).
const messageIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,32}$/, "invalid message id");

// Strict no-CRLF for any field that flows into a MIME header. Without
// this an attacker could supply subject="foo\r\nBcc: target@x" and the
// MIME builder below would happily inject extra headers — classic email
// header injection.
const headerSafeSchema = z.string()
  .regex(/^[^\r\n]+$/, "header value may not contain CR or LF")
  .max(998); // RFC 5322 line length

// Validate an email or comma-separated list of emails.
const recipientSchema = z.string()
  .regex(/^[^\r\n]+$/, "header value may not contain CR or LF")
  .refine((v) => v.split(",").every((p) => /^[^\s,<>"\\]+@[^\s,<>"\\]+$/.test(p.trim())), "must be a valid address or comma-separated addresses")
  .refine((v) => v.length <= 998, "too long");

export function registerTools(server: McpServer) {
  server.tool({
    name: "list",
    description: "List Gmail messages.",
    input: z.object({ q: z.string().optional(), maxResults: z.number().int().min(1).max(500).optional() }),
    handler: async ({ q, maxResults = 20 }) => (await client()).get<any>("users/me/messages", { q, maxResults }),
  });
  server.tool({
    name: "get",
    description: "Get a single message.",
    input: z.object({ id: messageIdSchema }),
    handler: async ({ id }) => (await client()).get<any>(`users/me/messages/${encodeURIComponent(id)}`),
  });
  server.tool({
    name: "search",
    description: "Search Gmail.",
    input: z.object({ q: z.string().min(1).max(1024) }),
    handler: async ({ q }) => (await client()).get<any>("users/me/messages", { q, maxResults: 50 }),
  });
  server.tool({
    name: "send",
    description: "Send a Gmail message (simple to/subject/body).",
    input: z.object({
      to: recipientSchema,
      subject: headerSafeSchema,
      body: z.string().max(5_000_000), // ~5 MB cap on the body
    }),
    handler: async ({ to, subject, body }) => {
      // Build the MIME with \r\n line endings (RFC 5322), base64-encoded
      // body so embedded "From " / 8-bit chars survive intact. The
      // header fields were already validated against CRLF by the schema
      // above, but we also fold subject through encoded-word for non-
      // ASCII so the chars don't end up as raw 8-bit in the header.
      const subjectEncoded = /^[\x20-\x7e]*$/.test(subject)
        ? subject
        : `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
      const bodyBase64 = Buffer.from(body, "utf8").toString("base64");
      const mime = [
        "From: me",
        `To: ${to}`,
        `Subject: ${subjectEncoded}`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: base64",
        "",
        bodyBase64,
      ].join("\r\n");
      const raw = Buffer.from(mime).toString("base64url");
      return (await client()).post<any>("users/me/messages/send", { raw });
    },
  });
}
