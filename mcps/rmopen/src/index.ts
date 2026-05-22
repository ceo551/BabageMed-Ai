import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "rmopen",
  name: "RMD Open",
  kind: "hybrid",
  category: "rheumatology",
  base: "https://rmdopen.bmj.com",
  port: 6145,
  version: "0.1.0",
});

registerTools(server);
server.run();
