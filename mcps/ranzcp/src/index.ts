import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ranzcp",
  name: "Royal Australian & New Zealand College of Psychiatrists",
  kind: "scrape",
  category: "psychiatry",
  base: "https://www.ranzcp.org",
  port: 6249,
  version: "0.1.0",
});

registerTools(server);
server.run();
