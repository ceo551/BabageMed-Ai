import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "igcs",
  name: "International Society of Gynecologic Cancer",
  kind: "scrape",
  category: "gyn-oncology",
  base: "https://igcs.org",
  port: 6231,
  version: "0.1.0",
});

registerTools(server);
server.run();
