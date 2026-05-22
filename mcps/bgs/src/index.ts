import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bgs",
  name: "British Geriatrics Society",
  kind: "scrape",
  category: "geriatrics",
  base: "https://www.bgs.org.uk",
  port: 6414,
  version: "0.1.0",
});

registerTools(server);
server.run();
