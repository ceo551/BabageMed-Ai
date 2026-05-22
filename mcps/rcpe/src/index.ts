import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "rcpe",
  name: "Royal College of Physicians of Edinburgh",
  kind: "scrape",
  category: "internal-medicine",
  base: "https://www.rcpe.ac.uk",
  port: 6456,
  version: "0.1.0",
});

registerTools(server);
server.run();
