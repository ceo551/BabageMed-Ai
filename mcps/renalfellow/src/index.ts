import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "renalfellow",
  name: "Renal Fellow Network",
  kind: "scrape",
  category: "nephrology",
  base: "https://www.renalfellow.org",
  port: 6140,
  version: "0.1.0",
});

registerTools(server);
server.run();
