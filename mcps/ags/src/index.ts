import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ags",
  name: "American Geriatrics Society",
  kind: "scrape",
  category: "geriatrics",
  base: "https://www.americangeriatrics.org",
  port: 6413,
  version: "0.1.0",
});

registerTools(server);
server.run();
