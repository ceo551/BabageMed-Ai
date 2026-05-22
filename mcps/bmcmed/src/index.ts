import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bmcmed",
  name: "BMC Medicine",
  kind: "scrape",
  category: "oa-journal",
  base: "https://bmcmedicine.biomedcentral.com",
  port: 6478,
  version: "0.1.0",
});

registerTools(server);
server.run();
