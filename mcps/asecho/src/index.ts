import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "asecho",
  name: "American Society of Echocardiography",
  kind: "scrape",
  category: "cardiology",
  base: "https://www.asecho.org",
  port: 6207,
  version: "0.1.0",
});

registerTools(server);
server.run();
