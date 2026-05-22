import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "stemlyns",
  name: "St Emlyn's",
  kind: "scrape",
  category: "emergency",
  base: "https://www.stemlynsblog.org",
  port: 6446,
  version: "0.1.0",
});

registerTools(server);
server.run();
