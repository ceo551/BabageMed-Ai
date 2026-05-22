import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "rcpch",
  name: "Royal College of Paediatrics & Child Health",
  kind: "scrape",
  category: "pediatrics",
  base: "https://www.rcpch.ac.uk",
  port: 6253,
  version: "0.1.0",
});

registerTools(server);
server.run();
