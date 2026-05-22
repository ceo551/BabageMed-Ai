import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "epiresearch",
  name: "Society for Epidemiologic Research",
  kind: "scrape",
  category: "epidemiology",
  base: "https://epiresearch.org",
  port: 6315,
  version: "0.1.0",
});

registerTools(server);
server.run();
