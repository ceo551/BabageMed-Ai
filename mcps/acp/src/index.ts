import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "acp",
  name: "American College of Physicians",
  kind: "scrape",
  category: "internal-medicine",
  base: "https://www.acponline.org",
  port: 6457,
  version: "0.1.0",
});

registerTools(server);
server.run();
