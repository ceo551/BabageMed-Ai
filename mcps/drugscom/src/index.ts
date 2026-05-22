import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "drugscom",
  name: "Drugs.com",
  kind: "scrape",
  category: "drugs",
  base: "https://www.drugs.com",
  port: 6122,
  version: "0.1.0",
});

registerTools(server);
server.run();
