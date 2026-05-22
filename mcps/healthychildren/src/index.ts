import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "healthychildren",
  name: "HealthyChildren.org",
  kind: "scrape",
  category: "pediatrics",
  base: "https://www.healthychildren.org",
  port: 6251,
  version: "0.1.0",
});

registerTools(server);
server.run();
