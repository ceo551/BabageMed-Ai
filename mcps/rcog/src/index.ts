import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "rcog",
  name: "Royal College of Obstetricians & Gynaecologists",
  kind: "scrape",
  category: "obgyn",
  base: "https://www.rcog.org.uk",
  port: 6363,
  version: "0.1.0",
});

registerTools(server);
server.run();
