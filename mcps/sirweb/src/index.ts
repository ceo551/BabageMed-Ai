import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "sirweb",
  name: "Society of Interventional Radiology",
  kind: "scrape",
  category: "radiology",
  base: "https://www.sirweb.org",
  port: 6260,
  version: "0.1.0",
});

registerTools(server);
server.run();
