import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "asge-patient",
  name: "ASGE Patient Center",
  kind: "scrape",
  category: "gastroenterology",
  base: "https://www.asge.org/home/for-patients",
  port: 6526,
  version: "0.1.0",
});

registerTools(server);
server.run();
