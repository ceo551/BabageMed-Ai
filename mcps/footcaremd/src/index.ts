import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "footcaremd",
  name: "FootCareMD",
  kind: "scrape",
  category: "orthopedics",
  base: "https://www.footcaremd.org",
  port: 6376,
  version: "0.1.0",
});

registerTools(server);
server.run();
