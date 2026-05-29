import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "msdynamics-365-business",
  name: "Microsoft Dynamics 365 Business",
  kind: "stub",
  category: "operations",
  base: "",
  port: 6595,
  version: "0.1.0",
});

registerTools(server);
server.run();
