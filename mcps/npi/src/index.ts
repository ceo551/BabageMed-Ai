import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "npi",
  name: "NPI Registry",
  kind: "api",
  category: "providers",
  base: "https://npiregistry.cms.hhs.gov/api",
  port: 6109,
  version: "0.1.0",
});

registerTools(server);
server.run();
