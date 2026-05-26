import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "prodpad",
  name: "ProdPad",
  kind: "stub",
  category: "productivity",
  base: "",
  port: 6725,
  version: "0.1.0",
});

registerTools(server);
server.run();
