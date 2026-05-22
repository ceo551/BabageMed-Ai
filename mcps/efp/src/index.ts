import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "efp",
  name: "European Federation of Periodontology",
  kind: "scrape",
  category: "dentistry",
  base: "https://www.efp.org",
  port: 6425,
  version: "0.1.0",
});

registerTools(server);
server.run();
