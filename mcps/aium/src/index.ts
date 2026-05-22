import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aium",
  name: "American Institute of Ultrasound in Medicine",
  kind: "scrape",
  category: "radiology",
  base: "https://www.aium.org",
  port: 6262,
  version: "0.1.0",
});

registerTools(server);
server.run();
