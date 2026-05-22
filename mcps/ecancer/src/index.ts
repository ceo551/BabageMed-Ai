import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ecancer",
  name: "ecancer",
  kind: "scrape",
  category: "oncology",
  base: "https://ecancer.org",
  port: 6233,
  version: "0.1.0",
});

registerTools(server);
server.run();
