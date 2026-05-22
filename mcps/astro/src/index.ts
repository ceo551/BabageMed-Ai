import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "astro",
  name: "American Society for Radiation Oncology",
  kind: "scrape",
  category: "radiation-oncology",
  base: "https://www.astro.org",
  port: 6232,
  version: "0.1.0",
});

registerTools(server);
server.run();
