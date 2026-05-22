import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "openprescribing",
  name: "OpenPrescribing.net",
  kind: "scrape",
  category: "pharmacoepidemiology",
  base: "https://openprescribing.net",
  port: 6271,
  version: "0.1.0",
});

registerTools(server);
server.run();
