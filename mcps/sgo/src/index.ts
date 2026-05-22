import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "sgo",
  name: "Society of Gynecologic Oncology",
  kind: "scrape",
  category: "gyn-oncology",
  base: "https://www.sgo.org",
  port: 6227,
  version: "0.1.0",
});

registerTools(server);
server.run();
