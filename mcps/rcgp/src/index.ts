import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "rcgp",
  name: "Royal College of General Practitioners",
  kind: "scrape",
  category: "family-medicine",
  base: "https://www.rcgp.org.uk",
  port: 6452,
  version: "0.1.0",
});

registerTools(server);
server.run();
