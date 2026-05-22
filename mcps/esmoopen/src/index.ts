import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "esmoopen",
  name: "ESMO Open",
  kind: "scrape",
  category: "oncology",
  base: "https://www.esmoopen.com",
  port: 6225,
  version: "0.1.0",
});

registerTools(server);
server.run();
