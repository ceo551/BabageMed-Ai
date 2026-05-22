import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "derangedphys",
  name: "Deranged Physiology",
  kind: "scrape",
  category: "critical-care",
  base: "https://derangedphysiology.com",
  port: 6150,
  version: "0.1.0",
});

registerTools(server);
server.run();
