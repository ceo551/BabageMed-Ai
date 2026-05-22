import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "facs",
  name: "American College of Surgeons",
  kind: "scrape",
  category: "surgery",
  base: "https://www.facs.org",
  port: 6281,
  version: "0.1.0",
});

registerTools(server);
server.run();
