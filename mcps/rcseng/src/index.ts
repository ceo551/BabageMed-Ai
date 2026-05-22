import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "rcseng",
  name: "Royal College of Surgeons of England",
  kind: "scrape",
  category: "surgery",
  base: "https://www.rcseng.ac.uk",
  port: 6282,
  version: "0.1.0",
});

registerTools(server);
server.run();
