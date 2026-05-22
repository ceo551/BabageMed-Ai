import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ifos",
  name: "IFOS",
  kind: "scrape",
  category: "ent",
  base: "https://www.ifosworld.org",
  port: 6354,
  version: "0.1.0",
});

registerTools(server);
server.run();
