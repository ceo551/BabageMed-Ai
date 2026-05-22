import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aaaai",
  name: "American Academy of Allergy, Asthma & Immunology",
  kind: "scrape",
  category: "allergy",
  base: "https://www.aaaai.org",
  port: 6396,
  version: "0.1.0",
});

registerTools(server);
server.run();
