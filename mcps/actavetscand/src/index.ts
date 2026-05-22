import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "actavetscand",
  name: "Acta Veterinaria Scandinavica",
  kind: "scrape",
  category: "veterinary",
  base: "https://actavetscand.biomedcentral.com",
  port: 6471,
  version: "0.1.0",
});

registerTools(server);
server.run();
