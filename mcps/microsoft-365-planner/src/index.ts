import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "microsoft-365-planner",
  name: "Microsoft 365 Planner",
  kind: "stub",
  category: "operations",
  base: "",
  port: 6660,
  version: "0.1.0",
});

registerTools(server);
server.run();
