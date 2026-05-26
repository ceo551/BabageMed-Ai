import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "dataforseo",
  name: "DataForSEO",
  kind: "stub",
  category: "marketing",
  base: "",
  port: 6742,
  version: "0.1.0",
});

registerTools(server);
server.run();
