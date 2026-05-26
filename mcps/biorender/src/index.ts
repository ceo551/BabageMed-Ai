import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "biorender",
  name: "BioRender",
  kind: "stub",
  category: "creative",
  base: "",
  port: 6552,
  version: "0.1.0",
});

registerTools(server);
server.run();
