import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aaoms",
  name: "American Association of Oral & Maxillofacial Surgeons",
  kind: "scrape",
  category: "dentistry",
  base: "https://www.aaoms.org",
  port: 6427,
  version: "0.1.0",
});

registerTools(server);
server.run();
