import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "orthoinfo",
  name: "OrthoInfo (AAOS)",
  kind: "scrape",
  category: "orthopedics",
  base: "https://orthoinfo.aaos.org",
  port: 6373,
  version: "0.1.0",
});

registerTools(server);
server.run();
