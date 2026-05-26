import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "microsoft-bookings",
  name:     "Microsoft Bookings",
  kind:     "api",
  category: "operations",
  base:     "",
  port:     6586,
  version:  "0.1.0",
});

registerTools(server);
server.run();
