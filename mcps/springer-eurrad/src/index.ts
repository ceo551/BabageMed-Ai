import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "springer-eurrad",
  name: "European Radiology (Springer)",
  kind: "scrape",
  category: "radiology",
  base: "https://link.springer.com/journal/330",
  port: 6265,
  version: "0.1.0",
});

registerTools(server);
server.run();
