import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "isaps",
  name: "International Society of Aesthetic Plastic Surgery",
  kind: "scrape",
  category: "plastic-surgery",
  base: "https://www.isaps.org",
  port: 6290,
  version: "0.1.0",
});

registerTools(server);
server.run();
