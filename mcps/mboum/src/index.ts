import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "mboum",
  name: "Mboum (stocks)",
  kind: "stub",
  category: "finance",
  base: "",
  port: 6686,
  version: "0.1.0",
});

registerTools(server);
server.run();
