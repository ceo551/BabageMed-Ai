import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "google-maps-places",
  name: "Google Maps (Places API)",
  kind: "stub",
  category: "developer",
  base: "",
  port: 6665,
  version: "0.1.0",
});

registerTools(server);
server.run();
