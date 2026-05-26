import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "connectwise-psa",
  name: "Connectwise PSA",
  kind: "stub",
  category: "operations",
  base: "",
  port: 6606,
  version: "0.1.0",
});

registerTools(server);
server.run();
