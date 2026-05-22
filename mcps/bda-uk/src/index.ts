import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bda-uk",
  name: "British Dietetic Association",
  kind: "scrape",
  category: "nutrition",
  base: "https://www.bda.uk.com",
  port: 6431,
  version: "0.1.0",
});

registerTools(server);
server.run();
