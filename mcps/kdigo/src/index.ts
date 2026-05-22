import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "kdigo",
  name: "KDIGO",
  kind: "scrape",
  category: "nephrology",
  base: "https://kdigo.org",
  port: 6138,
  version: "0.1.0",
});

registerTools(server);
server.run();
