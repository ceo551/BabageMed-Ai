import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "diabetesorg",
  name: "American Diabetes Association",
  kind: "scrape",
  category: "endocrinology",
  base: "https://diabetes.org",
  port: 6321,
  version: "0.1.0",
});

registerTools(server);
server.run();
