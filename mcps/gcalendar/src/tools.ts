import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
import { googleAccessToken } from "./google.js";
async function client() { const t = await googleAccessToken(); return new ApiClient({ base: "https://www.googleapis.com/calendar/v3", rps: 3, defaultHeaders: { Authorization: `Bearer ${t}` } }); }
export function registerTools(server: McpServer) {
  server.tool({ name: "list", description: "List upcoming events.", input: z.object({ calendarId: z.string().optional(), maxResults: z.number().int().min(1).max(2500).optional(), timeMin: z.string().optional() }), handler: async ({ calendarId = "primary", maxResults = 20, timeMin }) => (await client()).get<any>(`calendars/${calendarId}/events`, { maxResults, timeMin: timeMin || new Date().toISOString(), singleEvents: true, orderBy: "startTime" }) });
  server.tool({ name: "create", description: "Create an event.", input: z.object({ calendarId: z.string().optional(), event: z.unknown() }), handler: async ({ calendarId = "primary", event }) => (await client()).post<any>(`calendars/${calendarId}/events`, event) });
  server.tool({ name: "update", description: "Update an event.", input: z.object({ calendarId: z.string().optional(), eventId: z.string(), event: z.unknown() }), handler: async ({ calendarId = "primary", eventId, event }) => (await client()).request<any>(`calendars/${calendarId}/events/${eventId}`, { method: "PATCH", body: event }) });
  server.tool({ name: "delete", description: "Delete an event.", input: z.object({ calendarId: z.string().optional(), eventId: z.string() }), handler: async ({ calendarId = "primary", eventId }) => (await client()).request<any>(`calendars/${calendarId}/events/${eventId}`, { method: "DELETE" }) });
}
