import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "boa",
  name: "British Orthopaedic Association",
  kind: "scrape",
  category: "orthopedics",
  base: "https://www.boa.ac.uk",
  port: 6380,
  version: "0.1.0",
});

registerTools(server);
server.run();
