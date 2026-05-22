import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "breastsurgeons",
  name: "American Society of Breast Surgeons",
  kind: "scrape",
  category: "surgery",
  base: "https://www.breastsurgeons.org",
  port: 6288,
  version: "0.1.0",
});

registerTools(server);
server.run();
