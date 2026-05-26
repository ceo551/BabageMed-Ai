import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "activecampaign",
  name: "ActiveCampaign",
  kind: "stub",
  category: "marketing",
  base: "",
  port: 6622,
  version: "0.1.0",
});

registerTools(server);
server.run();
