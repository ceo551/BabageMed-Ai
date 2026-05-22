import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "psychiatrictimes",
  name: "Psychiatric Times",
  kind: "scrape",
  category: "psychiatry",
  base: "https://www.psychiatrictimes.com",
  port: 6154,
  version: "0.1.0",
});

registerTools(server);
server.run();
