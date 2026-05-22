import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "cancerorg",
  name: "ACS cancer.org",
  kind: "scrape",
  category: "oncology",
  base: "https://www.cancer.org",
  port: 6142,
  version: "0.1.0",
});

registerTools(server);
server.run();
