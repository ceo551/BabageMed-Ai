import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ms-power-bi",
  name: "Microsoft Power BI",
  kind: "stub",
  category: "analytics",
  base: "",
  port: 6693,
  version: "0.1.0",
});

registerTools(server);
server.run();
