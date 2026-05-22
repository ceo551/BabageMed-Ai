import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "rsna",
  name: "RSNA",
  kind: "scrape",
  category: "radiology",
  base: "https://www.rsna.org",
  port: 6107,
  version: "0.1.0",
});

registerTools(server);
server.run();
