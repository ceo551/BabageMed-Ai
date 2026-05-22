import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "isn",
  name: "International Society of Nephrology",
  kind: "scrape",
  category: "nephrology",
  base: "https://www.theisn.org",
  port: 6461,
  version: "0.1.0",
});

registerTools(server);
server.run();
