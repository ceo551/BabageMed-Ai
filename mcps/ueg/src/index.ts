import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ueg",
  name: "United European Gastroenterology",
  kind: "scrape",
  category: "gastroenterology",
  base: "https://ueg.eu",
  port: 6332,
  version: "0.1.0",
});

registerTools(server);
server.run();
