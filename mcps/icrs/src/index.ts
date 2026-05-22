import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "icrs",
  name: "ICRS (Cartilage)",
  kind: "scrape",
  category: "orthopedics",
  base: "https://cartilage.org",
  port: 6378,
  version: "0.1.0",
});

registerTools(server);
server.run();
