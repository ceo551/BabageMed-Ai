import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ipso",
  name: "International Society of Paediatric Surgical Oncology",
  kind: "scrape",
  category: "pediatric-oncology",
  base: "https://ipso-online.org",
  port: 6230,
  version: "0.1.0",
});

registerTools(server);
server.run();
