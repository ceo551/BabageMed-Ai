import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "stripe",
  name: "Stripe",
  kind: "stub",
  category: "finance",
  base: "",
  port: 6534,
  version: "0.1.0",
});

registerTools(server);
server.run();
