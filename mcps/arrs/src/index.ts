import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "arrs",
  name: "American Roentgen Ray Society (AJR)",
  kind: "scrape",
  category: "radiology",
  base: "https://www.arrs.org",
  port: 6261,
  version: "0.1.0",
});

registerTools(server);
server.run();
