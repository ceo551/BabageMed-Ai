import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "asco",
  name: "American Society of Clinical Oncology",
  kind: "scrape",
  category: "oncology",
  base: "https://www.asco.org",
  port: 6222,
  version: "0.1.0",
});

registerTools(server);
server.run();
