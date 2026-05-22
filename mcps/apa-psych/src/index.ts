import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "apa-psych",
  name: "American Psychiatric Association",
  kind: "scrape",
  category: "psychiatry",
  base: "https://www.psychiatry.org",
  port: 6244,
  version: "0.1.0",
});

registerTools(server);
server.run();
