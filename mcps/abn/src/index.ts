import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "abn",
  name: "Association of British Neurologists",
  kind: "scrape",
  category: "neurology",
  base: "https://www.theabn.org",
  port: 6238,
  version: "0.1.0",
});

registerTools(server);
server.run();
