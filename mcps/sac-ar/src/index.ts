import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "sac-ar",
  name: "Sociedad Argentina de Cardiología",
  kind: "scrape",
  category: "cardiology",
  base: "https://www.sac.org.ar",
  port: 6212,
  version: "0.1.0",
});

registerTools(server);
server.run();
