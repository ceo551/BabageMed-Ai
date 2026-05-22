import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "oncolink",
  name: "OncoLink",
  kind: "scrape",
  category: "oncology",
  base: "https://www.oncolink.org",
  port: 6143,
  version: "0.1.0",
});

registerTools(server);
server.run();
