import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aomrc",
  name: "Academy of Medical Royal Colleges",
  kind: "scrape",
  category: "society",
  base: "https://www.aomrc.org.uk",
  port: 6528,
  version: "0.1.0",
});

registerTools(server);
server.run();
