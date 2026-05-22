import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "esmo",
  name: "European Society for Medical Oncology",
  kind: "scrape",
  category: "oncology",
  base: "https://www.esmo.org",
  port: 6224,
  version: "0.1.0",
});

registerTools(server);
server.run();
