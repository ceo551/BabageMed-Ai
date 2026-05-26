import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "microsoft-excel",
  name: "Microsoft Excel",
  kind: "stub",
  category: "productivity",
  base: "",
  port: 6662,
  version: "0.1.0",
});

registerTools(server);
server.run();
