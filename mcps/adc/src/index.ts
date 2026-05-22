import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "adc",
  name: "Archives of Disease in Childhood (BMJ)",
  kind: "scrape",
  category: "pediatrics",
  base: "https://adc.bmj.com",
  port: 6257,
  version: "0.1.0",
});

registerTools(server);
server.run();
