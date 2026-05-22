import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "mayoclinic",
  name: "Mayo Clinic",
  kind: "scrape",
  category: "patient-ref",
  base: "https://www.mayoclinic.org",
  port: 6103,
  version: "0.1.0",
});

registerTools(server);
server.run();
