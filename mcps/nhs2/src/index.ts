import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "nhs2",
  name: "NHS (mirror)",
  kind: "api",
  category: "patient-ref",
  base: "https://api.nhs.uk",
  port: 6167,
  version: "0.1.0",
});

registerTools(server);
server.run();
