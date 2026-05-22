import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "rcpsg",
  name: "Royal College of Physicians & Surgeons of Glasgow",
  kind: "scrape",
  category: "surgery",
  base: "https://rcpsg.ac.uk",
  port: 6284,
  version: "0.1.0",
});

registerTools(server);
server.run();
