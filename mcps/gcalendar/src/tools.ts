// @hand-edited — do not regenerate via write-real-tools.mjs
import { z, McpServer, ApiClient, googleAccessToken } from "@babbage/mcp-base";
// Lazy, persistent client — see mcps/gmail for the rationale (per-call
// construction reset the rate-limit slot to 0 every call).
let _client: ApiClient | null = null;
async function client(): Promise<ApiClient> {
  if (!_client) _client = new ApiClient({ base: "https://www.googleapis.com/calendar/v3", rps: 3 });
  const t = await googleAccessToken();
  (_client as unknown as { opts: { defaultHeaders: Record<string, string> } }).opts.defaultHeaders = { Authorization: `Bearer ${t}` };
  return _client;
}
// Google calendar/event id shape — alphanumeric, dashes, underscore.
// Without these regexes any value would land in the URL path and could
// escape into a different endpoint.
const calIdSchema = z.string().regex(/^[A-Za-z0-9._@-]{1,256}$/);
const evIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,1024}$/);

export function registerTools(server: McpServer) {
  server.tool({
    name: "list",
    description: "List upcoming events.",
    input: z.object({
      calendarId: calIdSchema.optional(),
      maxResults: z.number().int().min(1).max(2500).optional(),
      timeMin: z.string().optional(),
    }),
    handler: async ({ calendarId = "primary", maxResults = 20, timeMin }) =>
      (await client()).get<any>(`calendars/${encodeURIComponent(calendarId)}/events`, {
        maxResults,
        timeMin: timeMin || new Date().toISOString(),
        singleEvents: true,
        orderBy: "startTime",
      }),
  });
  server.tool({
    name: "create",
    description: "Create an event.",
    // event is z.unknown() — but we set sendUpdates=none as the default
    // so a malicious payload can't fan out an email blast to attendees
    // without an explicit opt-in by the caller.
    input: z.object({ calendarId: calIdSchema.optional(), event: z.unknown(), sendUpdates: z.enum(["all", "externalOnly", "none"]).optional() }),
    handler: async ({ calendarId = "primary", event, sendUpdates = "none" }) =>
      (await client()).post<any>(`calendars/${encodeURIComponent(calendarId)}/events`, event, {
        query: { sendUpdates },
      } as any),
  });
  server.tool({
    name: "update",
    description: "Update an event.",
    input: z.object({ calendarId: calIdSchema.optional(), eventId: evIdSchema, event: z.unknown(), sendUpdates: z.enum(["all", "externalOnly", "none"]).optional() }),
    handler: async ({ calendarId = "primary", eventId, event, sendUpdates = "none" }) =>
      (await client()).request<any>(`calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
        method: "PATCH",
        body: event,
        query: { sendUpdates },
      } as any),
  });
  server.tool({
    name: "delete",
    description: "Delete an event. Requires confirm: true so the LLM cannot one-shot delete by accident.",
    // confirm flag: irreversible action, the caller must explicitly opt in.
    input: z.object({ calendarId: calIdSchema.optional(), eventId: evIdSchema, confirm: z.literal(true) }),
    handler: async ({ calendarId = "primary", eventId }) =>
      (await client()).request<any>(`calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
        method: "DELETE",
      }),
  });
}
