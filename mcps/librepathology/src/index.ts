import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "librepathology",
  name: "Libre Pathology",
  kind: "scrape",
  category: "pathology",
  base: "https://librepathology.org",
  port: 6405,
  version: "0.1.0",
});

registerTools(server);
server.run();
