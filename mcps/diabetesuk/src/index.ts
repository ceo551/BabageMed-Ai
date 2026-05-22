import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "diabetesuk",
  name: "Diabetes UK",
  kind: "scrape",
  category: "endocrinology",
  base: "https://www.diabetes.org.uk",
  port: 6326,
  version: "0.1.0",
});

registerTools(server);
server.run();
