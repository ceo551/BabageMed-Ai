import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "thebottomline",
  name: "The Bottom Line",
  kind: "scrape",
  category: "critical-care",
  base: "https://www.thebottomline.org.uk",
  port: 6151,
  version: "0.1.0",
});

registerTools(server);
server.run();
