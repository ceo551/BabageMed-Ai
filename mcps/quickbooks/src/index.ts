import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "quickbooks",
  name: "QuickBooks",
  kind: "stub",
  category: "finance",
  base: "",
  port: 6745,
  version: "0.1.0",
});

registerTools(server);
server.run();
