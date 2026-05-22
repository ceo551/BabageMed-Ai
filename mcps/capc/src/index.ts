import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "capc",
  name: "Center to Advance Palliative Care",
  kind: "scrape",
  category: "palliative-care",
  base: "https://www.capc.org",
  port: 6420,
  version: "0.1.0",
});

registerTools(server);
server.run();
