import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "easd",
  name: "European Association for the Study of Diabetes",
  kind: "scrape",
  category: "endocrinology",
  base: "https://www.easd.org",
  port: 6324,
  version: "0.1.0",
});

registerTools(server);
server.run();
