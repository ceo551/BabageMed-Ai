import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "rsm",
  name: "Royal Society of Medicine",
  kind: "scrape",
  category: "society",
  base: "https://www.rsm.ac.uk",
  port: 6527,
  version: "0.1.0",
});

registerTools(server);
server.run();
