import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "familydoctor",
  name: "FamilyDoctor.org",
  kind: "scrape",
  category: "primary-care",
  base: "https://familydoctor.org",
  port: 6159,
  version: "0.1.0",
});

registerTools(server);
server.run();
