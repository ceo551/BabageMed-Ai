import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "nhs",
  name: "NHS",
  kind: "api",
  category: "patient-ref",
  base: "https://api.nhs.uk",
  port: 6124,
  version: "0.1.0",
});

registerTools(server);
server.run();
