import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "mds-movement",
  name: "International Parkinson and Movement Disorder Society",
  kind: "scrape",
  category: "neurology",
  base: "https://www.movementdisorders.org",
  port: 6240,
  version: "0.1.0",
});

registerTools(server);
server.run();
