import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "acc",
  name: "American College of Cardiology",
  kind: "scrape",
  category: "cardiology",
  base: "https://www.acc.org",
  port: 6201,
  version: "0.1.0",
});

registerTools(server);
server.run();
