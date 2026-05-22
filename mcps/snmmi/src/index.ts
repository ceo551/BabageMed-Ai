import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "snmmi",
  name: "Society of Nuclear Medicine & Molecular Imaging",
  kind: "scrape",
  category: "nuclear-medicine",
  base: "https://www.snmmi.org",
  port: 6263,
  version: "0.1.0",
});

registerTools(server);
server.run();
