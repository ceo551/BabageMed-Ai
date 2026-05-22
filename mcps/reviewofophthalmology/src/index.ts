import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "reviewofophthalmology",
  name: "Review of Ophthalmology",
  kind: "scrape",
  category: "ophthalmology",
  base: "https://www.reviewofophthalmology.com",
  port: 6361,
  version: "0.1.0",
});

registerTools(server);
server.run();
