import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "clevelandclinic",
  name: "Cleveland Clinic",
  kind: "scrape",
  category: "patient-ref",
  base: "https://my.clevelandclinic.org",
  port: 6104,
  version: "0.1.0",
});

registerTools(server);
server.run();
