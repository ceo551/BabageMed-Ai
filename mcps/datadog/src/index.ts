import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "datadog",
  name: "Datadog",
  kind: "stub",
  category: "developer",
  base: "",
  port: 6701,
  version: "0.1.0",
});

registerTools(server);
server.run();
