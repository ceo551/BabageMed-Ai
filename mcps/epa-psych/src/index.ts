import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "epa-psych",
  name: "European Psychiatric Association",
  kind: "scrape",
  category: "psychiatry",
  base: "https://www.europsy.net",
  port: 6246,
  version: "0.1.0",
});

registerTools(server);
server.run();
