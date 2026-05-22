import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "iscp",
  name: "International Society of Cardiovascular Pharmacotherapy",
  kind: "scrape",
  category: "cardiology",
  base: "https://www.iscpcardio.org",
  port: 6210,
  version: "0.1.0",
});

registerTools(server);
server.run();
