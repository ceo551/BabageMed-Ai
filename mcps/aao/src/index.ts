import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aao",
  name: "American Academy of Ophthalmology",
  kind: "scrape",
  category: "ophthalmology",
  base: "https://www.aao.org",
  port: 6355,
  version: "0.1.0",
});

registerTools(server);
server.run();
