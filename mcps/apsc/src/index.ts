import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "apsc",
  name: "Asian Pacific Society of Cardiology",
  kind: "scrape",
  category: "cardiology",
  base: "https://www.apscardio.org",
  port: 6211,
  version: "0.1.0",
});

registerTools(server);
server.run();
