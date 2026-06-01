import { McpServer } from "@pervagans/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "gcalendar",
  name: "Google Calendar",
  kind: "api",
  category: "productivity",
  base: "https://www.googleapis.com/calendar/v3",
  port: 6180,
  version: "0.1.0",
});

registerTools(server);
server.run();
