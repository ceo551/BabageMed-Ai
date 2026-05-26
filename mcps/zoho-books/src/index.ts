import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "zoho-books",
  name: "Zoho Books",
  kind: "stub",
  category: "finance",
  base: "",
  port: 6748,
  version: "0.1.0",
});

registerTools(server);
server.run();
