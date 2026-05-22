import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "cancernet",
  name: "Cancer.Net (ASCO patient site)",
  kind: "scrape",
  category: "oncology",
  base: "https://www.cancer.net",
  port: 6223,
  version: "0.1.0",
});

registerTools(server);
server.run();
