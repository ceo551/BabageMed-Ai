import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "msdynamics-365-sales",
  name: "Microsoft Dynamics 365 Sales",
  kind: "stub",
  category: "sales",
  base: "",
  port: 6621,
  version: "0.1.0",
});

registerTools(server);
server.run();
