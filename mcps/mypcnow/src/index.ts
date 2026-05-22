import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "mypcnow",
  name: "Palliative Care Network of Wisconsin (Fast Facts)",
  kind: "scrape",
  category: "palliative-care",
  base: "https://www.mypcnow.org",
  port: 6421,
  version: "0.1.0",
});

registerTools(server);
server.run();
