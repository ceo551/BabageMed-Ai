import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "pmda",
  name: "PMDA Japan",
  kind: "scrape",
  category: "drug-regulation",
  base: "https://www.pmda.go.jp/english/",
  port: 6275,
  version: "0.1.0",
});

registerTools(server);
server.run();
