import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "eapc",
  name: "European Association for Palliative Care",
  kind: "scrape",
  category: "palliative-care",
  base: "https://www.eapcnet.eu",
  port: 6418,
  version: "0.1.0",
});

registerTools(server);
server.run();
