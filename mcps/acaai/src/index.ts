import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "acaai",
  name: "American College of Allergy, Asthma & Immunology",
  kind: "scrape",
  category: "allergy",
  base: "https://acaai.org",
  port: 6397,
  version: "0.1.0",
});

registerTools(server);
server.run();
