import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "twilio",
  name: "Twilio",
  kind: "stub",
  category: "communication",
  base: "",
  port: 6574,
  version: "0.1.0",
});

registerTools(server);
server.run();
