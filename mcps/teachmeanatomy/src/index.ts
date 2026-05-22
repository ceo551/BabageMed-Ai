import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "teachmeanatomy",
  name: "TeachMeAnatomy",
  kind: "scrape",
  category: "med-ed",
  base: "https://teachmeanatomy.info",
  port: 6521,
  version: "0.1.0",
});

registerTools(server);
server.run();
