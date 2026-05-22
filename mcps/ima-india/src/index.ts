import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ima-india",
  name: "Indian Medical Association",
  kind: "scrape",
  category: "society",
  base: "https://www.ima-india.org/ima/",
  port: 6517,
  version: "0.1.0",
});

registerTools(server);
server.run();
