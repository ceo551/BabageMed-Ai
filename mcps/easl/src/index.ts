import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "easl",
  name: "European Association for the Study of the Liver",
  kind: "scrape",
  category: "hepatology",
  base: "https://easl.eu",
  port: 6334,
  version: "0.1.0",
});

registerTools(server);
server.run();
